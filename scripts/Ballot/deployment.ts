import { ethers } from "ethers";
import { Ballot } from "../../typechain";
import BallotArtifact from "../../artifacts/contracts/Ballot.sol/Ballot.json"
import { EXPOSED_KEY } from './key';


function convertStringArrayToBytes32(array: string[]) {
    const bytes32Array = [];
    for (let index = 0; index < array.length; index++) {
      bytes32Array.push(ethers.utils.formatBytes32String(array[index]));1
    }
    return bytes32Array;
}

const PROPOSALS = ["Proposal 1", "Proposal 2", "Proposal 3"];


async function main() {
    const wallet = 
        process.env.MNEMONIC && process.env.MNEMONIC.length > 0 
        ? ethers.Wallet.fromMnemonic(process.env.MNEMONIC)
        : new ethers.Wallet(process.env.PRIVATE_KEY ?? EXPOSED_KEY);

    const provider = ethers.providers.getDefaultProvider('ropsten');

    const signer = wallet.connect(provider);
    console.log(`signer: ${signer.address}`)
    const balance = Number(ethers.utils.formatEther(await signer.getBalance()))
    console.log(`balance: ${balance}`);
    const ballotFactory = await new ethers.ContractFactory(BallotArtifact.abi, BallotArtifact.bytecode, signer);
    const ballotContract: Ballot = await ballotFactory.deploy(convertStringArrayToBytes32(PROPOSALS)) as Ballot;
    console.log('waiting confirmation');
    const deployTx = await ballotContract.deployed();
    console.log("deployed at", deployTx.address);
    for(let index = 0; index < PROPOSALS.length; index++) {
        const proposal = await ballotContract.proposals(index);
        console.log(`Proposal at ${index} is named ${ethers.utils.parseBytes32String(proposal[0])}`)
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
})