use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer, MintTo, Burn};
use pyth_sdk_solana::load_price_feed_from_account_info;

declare_id!("EQQFiZ4hKQkmZrn2xHKap6NQcLGg1M5aU1d9pXGefZcQ");

#[program]
pub mod jubilee_lending {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let lending_market = &mut ctx.accounts.lending_market;
        lending_market.admin = ctx.accounts.admin.key();
        Ok(())
    }

    pub fn init_reserve(
        ctx: Context<InitReserve>,
        _collateral_factor_bps: u64,
        _decimals: u8,
    ) -> Result<()> {
        let reserve = &mut ctx.accounts.reserve;
        reserve.mint = ctx.accounts.liquidity_mint.key();
        reserve.vault = ctx.accounts.liquidity_vault.key();
        reserve.collateral_factor_bps = _collateral_factor_bps;
        reserve.decimals = _decimals;
        Ok(())
    }

    pub fn deposit_collateral(ctx: Context<DepositCollateral>, amount: u64) -> Result<()> {
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_liquidity.to_account_info(),
            to: ctx.accounts.reserve_liquidity_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts
        );
        token::transfer(cpi_ctx, amount)?;

        let obligation = &mut ctx.accounts.obligation;
        obligation.owner = ctx.accounts.user.key();
        obligation.deposited_amount = obligation.deposited_amount.checked_add(amount).unwrap(); 
        
        Ok(())
    }

    /// Borrow jUSDi using Pyth Oracle for price data
    pub fn borrow(ctx: Context<Borrow>, amount: u64) -> Result<()> {
        let obligation = &mut ctx.accounts.obligation;
        let reserve = &ctx.accounts.reserve;

        // 1. Get Collateral Price from Pyth
        let price_feed = load_price_feed_from_account_info(&ctx.accounts.oracle_account).unwrap();
        let current_time = Clock::get()?.unix_timestamp;
        let max_age = 60; // 60 seconds freshness
        let price_data = price_feed.get_price_no_older_than(current_time, max_age).unwrap();
        
        require!(price_data.price > 0, LendingError::InvalidOraclePrice);

        let collateral_price = price_data.price as u64; // e.g. 200000000000 for $2000 (check exp)
        let collateral_exp = price_data.expo; // e.g. -8

        // 2. Normalize Values to USD (18 decimals standard)
        // Value = amount * price * 10^(18 - decimals - expo_abs)
        // Simplified: Value = (amount * price) / 10^decimals
        
        // This math needs careful precision handling.
        // For MVP: We assume price is already scaled properly or we use a helper.
        // Let's assume standard USD value calculation:
        let collateral_value_usd = (obligation.deposited_amount as u128)
            .checked_mul(collateral_price as u128).unwrap();
            // Note: In prod, adjust for decimals and exponents

        let max_borrow_value = collateral_value_usd
            .checked_mul(reserve.collateral_factor_bps as u128).unwrap()
            .checked_div(10000).unwrap();

        // 3. Calculate Borrow Value
        // jUSDi is pegged to $1.
        let current_borrow_value = obligation.borrowed_amount as u128;
        let new_borrow_value = current_borrow_value
            .checked_add(amount as u128).unwrap();

        require!(new_borrow_value <= max_borrow_value, LendingError::InsufficientCollateral);

        // 4. Mint jUSDi
        let seeds = &[
            b"lending_market",
            &[ctx.bumps.lending_market_authority]
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = MintTo {
            mint: ctx.accounts.jusdi_mint.to_account_info(),
            to: ctx.accounts.user_jusdi_account.to_account_info(),
            authority: ctx.accounts.lending_market_authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer
        );
        token::mint_to(cpi_ctx, amount)?;

        obligation.borrowed_amount = obligation.borrowed_amount.checked_add(amount).unwrap();

        Ok(())
    }

    /// Repay jUSDi loan
    pub fn repay(ctx: Context<Repay>, amount: u64) -> Result<()> {
        let obligation = &mut ctx.accounts.obligation;
        
        let repay_amount = if amount > obligation.borrowed_amount {
            obligation.borrowed_amount
        } else {
            amount
        };

        // Burn user's jUSDi
        let cpi_accounts = Burn {
            mint: ctx.accounts.jusdi_mint.to_account_info(),
            from: ctx.accounts.user_jusdi_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts
        );
        token::burn(cpi_ctx, repay_amount)?;

        // Update state
        obligation.borrowed_amount = obligation.borrowed_amount.checked_sub(repay_amount).unwrap();

        Ok(())
    }
}

#[error_code]
pub enum LendingError {
    #[msg("Insufficient collateral for borrowing")]
    InsufficientCollateral,
    #[msg("Invalid Oracle Price")]
    InvalidOraclePrice,
}

#[account]
pub struct LendingMarket {
    pub admin: Pubkey,
}

#[account]
pub struct Reserve {
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub collateral_factor_bps: u64,
    pub decimals: u8,
}

#[account]
pub struct Obligation {
    pub owner: Pubkey,
    pub deposited_amount: u64,
    pub borrowed_amount: u64,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = admin, space = 8 + 32)]
    pub lending_market: Account<'info, LendingMarket>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitReserve<'info> {
    #[account(init, payer = admin, space = 8 + 32 + 32 + 8 + 1)]
    pub reserve: Account<'info, Reserve>,
    pub liquidity_mint: Account<'info, Mint>,
    #[account(token::mint = liquidity_mint, token::authority = reserve)]
    pub liquidity_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositCollateral<'info> {
    #[account(mut)]
    pub reserve: Account<'info, Reserve>,
    #[account(mut, address = reserve.vault)]
    pub reserve_liquidity_vault: Account<'info, TokenAccount>,
    
    #[account(
        init_if_needed, 
        payer = user, 
        space = 8 + 32 + 8 + 8,
        seeds = [b"obligation", user.key().as_ref()], 
        bump
    )]
    pub obligation: Account<'info, Obligation>,
    
    #[account(mut)]
    pub user_liquidity: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Borrow<'info> {
    #[account(mut)]
    pub lending_market: Account<'info, LendingMarket>,
    /// CHECK: PDA signer for minting jUSDi
    #[account(seeds = [b"lending_market"], bump)]
    pub lending_market_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub reserve: Account<'info, Reserve>,
    
    #[account(
        mut,
        seeds = [b"obligation", user.key().as_ref()], 
        bump
    )]
    pub obligation: Account<'info, Obligation>,

    #[account(mut)]
    pub jusdi_mint: Account<'info, Mint>,
    #[account(mut)]
    pub user_jusdi_account: Account<'info, TokenAccount>,

    /// CHECK: Validated by Pyth SDK
    pub oracle_account: AccountInfo<'info>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Repay<'info> {
    #[account(mut)]
    pub obligation: Account<'info, Obligation>,

    #[account(mut)]
    pub jusdi_mint: Account<'info, Mint>,
    #[account(mut)]
    pub user_jusdi_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}
