import { Contract, ethers } from "ethers";
import * as ballotJson from "../../artifacts/contracts/Ballot.sol/Ballot.json";
import { Ballot } from "../../typechain";
import { EXPOSED_KEY } from "./key";

function convertStringArrayFromBytes32(array: any[]) {
    const stringArrray = [];
    for (let index = 0; index < array.length; index++) {
      stringArrray.push(ethers.utils.parseBytes32String(array[index].name));
    }
    return stringArrray;
}
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
  const ballotAddress = process.argv[2];
  const ballotContract: Ballot = new Contract(
      ballotAddress,
      ballotJson.abi,
      signer
  ) as Ballot;
    const arr = [];
    const proposals = await ballotContract.getProposals();
    console.log(`proposals: ${convertStringArrayFromBytes32(proposals)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
