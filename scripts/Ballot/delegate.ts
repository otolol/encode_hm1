import { Contract, ethers } from "ethers";
import * as ballotJson from "../../artifacts/contracts/Ballot.sol/Ballot.json";
import { Ballot } from "../../typechain";
import { EXPOSED_KEY } from "./key";

async function main() {
  const wallet =
    process.env.MNEMONIC && process.env.MNEMONIC.length > 0
      ? ethers.Wallet.fromMnemonic(process.env.MNEMONIC)
      : new ethers.Wallet(process.env.PRIVATE_KEY ?? EXPOSED_KEY);

  console.log(`Using address ${wallet.address}`);
  const provider = ethers.providers.getDefaultProvider('ropsten');
  const signer = wallet.connect(provider);
  const balance = Number(ethers.utils.formatEther(await signer.getBalance()));
  console.log(`Wallet balance ${balance}`);
  if (balance < 0.01) {
    throw new Error("Not enough ether");
  }
  if (process.argv.length < 3) {
    throw new Error("Ballot address missing")
  }
  if(process.argv.length < 4) {
    throw new Error("Delegate adress missing");
  }
  
  const ballotAddress = process.argv[2];
  const delegateAdress = process.argv[3];
  const ballotContract: Ballot = new Contract(
      ballotAddress,
      ballotJson.abi,
      signer
  ) as Ballot;
  const tx = await ballotContract.delegate(delegateAdress);
  console.log("Awaiting confirmations");
  await tx.wait();
  console.log(`Transaction completed. Hash: ${tx.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
