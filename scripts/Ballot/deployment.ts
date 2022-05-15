import { ethers } from "ethers";
import { Ballot } from "../../typechain";
import BallotArtifact from "../../artifacts/contracts/Ballot.sol/Ballot.json"


function convertStringArrayToBytes32(array: string[]) {
    const bytes32Array = [];
    for (let index = 0; index < array.length; index++) {
      bytes32Array.push(ethers.utils.formatBytes32String(array[index]));1
    }
    return bytes32Array;
}

const PROPOSALS = ["Proposal 1", "Proposal 2", "Proposal 3"];

const EXPOSTED_KEY = "";

async function main() {
    const wallet = 
        process.env.MNEMONIC && process.env.MNEMONIC.length > 0 
        ? ethers.Wallet.fromMnemonic(process.env.MNEMONIC)
        : new ethers.Wallet(process.env.PRIVATE_KEY ?? EXPOSTED_KEY);

    const provider = ethers.providers.getDefaultProvider('ropsten');

    const signer = wallet.connect(provider);
    // const balance = Number(ethers.utils.formatEther(await signer.getBalance()))
    const ballotFactory = await new ethers.ContractFactory(BallotArtifact.abi, BallotArtifact.bytecode, signer);
    const ballotContract: Ballot = await ballotFactory.deploy(convertStringArrayToBytes32(PROPOSALS)) as Ballot;
    console.log('waiting confirmation');
    const deployTx = await ballotContract.deployed();
    console.log("deployed", {deployTx})
    for(let index = 0; index < PROPOSALS.length; index++) {
        const proposal = await ballotContract.proposals(index);
        console.log(`Proposal at ${index} is named ${ethers.utils.parseBytes32String(proposal[0])}`)
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
})