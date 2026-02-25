const anchor = require("@coral-xyz/anchor");

describe("jubilee_lending", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  it("Is initialized!", async () => {
    // Add your test here.
    const program = anchor.workspace.JubileeLending;
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
