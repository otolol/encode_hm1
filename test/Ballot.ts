import { expect } from "chai";
import { ethers } from "hardhat";
// eslint-disable-next-line node/no-missing-import
import { Ballot } from "../typechain";

const PROPOSALS = ["Proposal 1", "Proposal 2", "Proposal 3"];

function convertStringArrayToBytes32(array: string[]) {
  const bytes32Array = [];
  for (let index = 0; index < array.length; index++) {
    bytes32Array.push(ethers.utils.formatBytes32String(array[index]));
  }
  return bytes32Array;
}

async function giveRightToVote(ballotContract: Ballot, voterAddress: any) {
  const tx = await ballotContract.giveRightToVote(voterAddress);
  await tx.wait();
}

async function vote(ballotContract: Ballot, proposal: any) {
  const tx = await ballotContract.vote(proposal);
  await tx.wait();
}

describe("Ballot", function () {
  let ballotContract: Ballot;
  let accounts: any[];

  this.beforeEach(async function () {
    accounts = await ethers.getSigners();
    const ballotFactory = await ethers.getContractFactory("Ballot");
    ballotContract = await ballotFactory.deploy(
      convertStringArrayToBytes32(PROPOSALS)
    );
    await ballotContract.deployed();
  });

  describe("when the contract is deployed", function () {
    it("has the provided proposals", async function () {
      for (let index = 0; index < PROPOSALS.length; index++) {
        const proposal = await ballotContract.proposals(index);
        expect(ethers.utils.parseBytes32String(proposal.name)).to.eq(
          PROPOSALS[index]
        );
      }
    });

    it("has zero votes for all proposals", async function () {
      for (let index = 0; index < PROPOSALS.length; index++) {
        const proposal = await ballotContract.proposals(index);
        expect(proposal.voteCount.toNumber()).to.eq(0);
      }
    });

    it("sets the deployer address as chairperson", async function () {
      const chairperson = await ballotContract.chairperson();
      expect(chairperson).to.eq(accounts[0].address);
    });

    it("sets the voting weight for the chairperson as 1", async function () {
      const chairpersonVoter = await ballotContract.voters(accounts[0].address);
      expect(chairpersonVoter.weight.toNumber()).to.eq(1);
    });
  });

  describe("when the chairperson interacts with the giveRightToVote function in the contract", function () {
    it("gives right to vote for another address", async function () {
      const voterAddress = accounts[1].address;
      await giveRightToVote(ballotContract, voterAddress);
      const voter = await ballotContract.voters(voterAddress);
      expect(voter.weight.toNumber()).to.eq(1);
    });

    it("can not give right to vote for someone that has voted", async function () {
      const voterAddress = accounts[1].address;
      await giveRightToVote(ballotContract, voterAddress);
      await ballotContract.connect(accounts[1]).vote(0);
      await expect(
        giveRightToVote(ballotContract, voterAddress)
      ).to.be.revertedWith("The voter already voted.");
    });

    it("can not give right to vote for someone that has already voting rights", async function () {
      const voterAddress = accounts[1].address;
      await giveRightToVote(ballotContract, voterAddress);
      await expect(
        giveRightToVote(ballotContract, voterAddress)
      ).to.be.revertedWith("");
    });
  });

  describe("when the voter interact with the vote function in the contract", function () {
    it("should revert if the voter has not been given right to vote", async function () {
      await expect(
        ballotContract.connect(accounts[1]).vote(0)
      ).to.be.revertedWith("Has no right to vote");
    });

    it("should revert if the voter has already voted", async function () {
      const voter = accounts[1];
      await giveRightToVote(ballotContract, voter.address);
      await ballotContract.connect(voter).vote(1);
      await expect(ballotContract.connect(voter).vote(1)).to.be.revertedWith(
        "Already voted."
      );
    });

    it("should set the voted property to true", async function () {
      const voter = accounts[1];
      await giveRightToVote(ballotContract, voter.address);
      await ballotContract.connect(voter).vote(1);
      const voterData = await ballotContract.voters(accounts[1].address);
      expect(voterData.voted).to.eq(true);
    });

    it("should set vote property to proposal of choice", async function () {
      const voter = accounts[1];
      await giveRightToVote(ballotContract, voter.address);
      await ballotContract.connect(voter).vote(1);
      const voterData = await ballotContract.voters(accounts[1].address);
      expect(voterData.vote).to.eq(1);
    });

    it("should increment the proposal's vote count with the sender weight", async function () {
      const voter = accounts[1];
      await giveRightToVote(ballotContract, voter.address);
      // Vote as chairperson
      await ballotContract.vote(1);
      // Vote as a voter
      await ballotContract.connect(voter).vote(1);
      const proposalData = await ballotContract.proposals(1);
      expect(proposalData.voteCount).to.eq(2);
    });
  });

  describe("when the voter interact with the delegate function in the contract", function () {
    it("should not allow self delegation", async function () {
      const voter = accounts[1];
      await expect(
        ballotContract.connect(voter).delegate(voter.address)
      ).to.be.revertedWith("Self-delegation is disallowed.");
    });

    it("should revert if msg.sender is found in the delegation loop", async function () {
      const voter = accounts[1];
      const delegatee = accounts[2];
      await giveRightToVote(ballotContract, voter.address);
      await giveRightToVote(ballotContract, delegatee.address);
      await ballotContract.connect(delegatee).delegate(voter.address);
      await expect(
        ballotContract.connect(voter).delegate(delegatee.address)
      ).to.be.revertedWith("Found loop in delegation.");
    });

    it("should delegate to other address(delegatee's delegate) if delegatee has delegated", async function () {
      const voter = accounts[1];
      const delegatee = accounts[2];
      const finalDelegatee = accounts[3];
      await giveRightToVote(ballotContract, voter.address);
      await giveRightToVote(ballotContract, delegatee.address);
      await giveRightToVote(ballotContract, finalDelegatee.address);
      // Delegatee has delegated to another address before voter delegates
      await ballotContract.connect(delegatee).delegate(finalDelegatee.address);
      await ballotContract.connect(voter).delegate(delegatee.address);
      const voterData = await ballotContract.voters(voter.address);
      expect(voterData.delegate).to.eq(finalDelegatee.address);
    });

    it("should not allow delegation if you have voted", async function () {
      const voter = accounts[1];
      await giveRightToVote(ballotContract, voter.address);
      await ballotContract.connect(voter).vote(1);
      await expect(
        ballotContract.connect(voter).delegate(accounts[2].address)
      ).to.be.revertedWith("You already voted.");
    });

    it("should not allow delegation to wallets that cannot vote", async function () {
      await expect(
        ballotContract.connect(accounts[1]).delegate(accounts[2].address)
      ).to.be.reverted;
    });

    it("should set the voted property to true after delegation", async function () {
      const voter = accounts[1];
      const delegatee = accounts[2];
      // Give right to vote to both voter and delegatee
      await giveRightToVote(ballotContract, voter.address);
      await giveRightToVote(ballotContract, delegatee.address);
      await ballotContract.connect(voter).delegate(delegatee.address);
      const voterData = await ballotContract.voters(voter.address);
      expect(voterData.voted).to.eq(true);
    });

    it("should set delegate property to the required account", async function () {
      const voter = accounts[1];
      const delegatee = accounts[2];
      // Give right to vote to both voter and delegatee
      await giveRightToVote(ballotContract, voter.address);
      await giveRightToVote(ballotContract, delegatee.address);
      await ballotContract.connect(voter).delegate(delegatee.address);
      const voterData = await ballotContract.voters(voter.address);
      expect(voterData.delegate).to.eq(delegatee.address);
    });

    it("should add direct to proposal votes if delegatee has already voted", async function () {
      const voter = accounts[1];
      const delegatee = accounts[2];
      // Give right to vote to both voter and delegatee
      await giveRightToVote(ballotContract, voter.address);
      await giveRightToVote(ballotContract, delegatee.address);
      // Delegatee has voted
      await ballotContract.connect(delegatee).vote(1);
      expect((await ballotContract.proposals(1)).voteCount).to.be.eq(1);
      await ballotContract.connect(voter).delegate(delegatee.address);
      expect((await ballotContract.proposals(1)).voteCount).to.be.eq(2);
    });

    it("should add to the delegatee weight if the delegetee has not voted", async function () {
      const voter = accounts[1];
      const delegatee = accounts[2];
      // Give right to vote to both voter and delegatee
      await giveRightToVote(ballotContract, voter.address);
      await giveRightToVote(ballotContract, delegatee.address);
      expect((await ballotContract.voters(delegatee.address)).weight).to.eq(1);
      await ballotContract.connect(voter).delegate(delegatee.address);
      expect((await ballotContract.voters(delegatee.address)).weight).to.eq(2);
    });
  });

  describe("when the an attacker interact with the giveRightToVote function in the contract", function () {
    it("should be reverted since the attacker is not the chairperson", async function () {
      await expect(
        ballotContract.connect(accounts[1]).giveRightToVote(accounts[1].address)
      ).to.be.revertedWith("Only chairperson can give right to vote.");
    });
  });

  describe("when the an attacker interact with the vote function in the contract", function () {
    it("should be reverted since the attacker has not been given rights to vote by chairperson", async function () {
      await expect(
        ballotContract.connect(accounts[1]).vote(0)
      ).to.be.revertedWith("Has no right to vote");
    });
  });

  describe("when the an attacker interact with the delegate function in the contract", function () {
    it("should be reverted if delegatee has no weight", async function () {
      const attacker = accounts[1];
      const delegatee = accounts[2];
      await expect(ballotContract.connect(attacker).delegate(delegatee.address))
        .to.be.reverted;
    });

    it("should delegate with a weight of 0 if the delegatee has the rights to vote", async function () {
      const attacker = accounts[1];
      const delegatee = accounts[2];
      await giveRightToVote(ballotContract, delegatee.address);
      await ballotContract.connect(attacker).delegate(delegatee.address);
      const delegateeData = await ballotContract.voters(delegatee.address);
      expect(delegateeData.weight).to.eq(1);
    });
  });

  describe("when someone interact with the winningProposal function before any votes are cast", function () {
    it("should expect winningProposal to return as default variable(0)", async function () {
      expect(await ballotContract.winningProposal()).to.be.eq(0);
    });
  });

  describe("when someone interact with the winningProposal function after one vote is cast for the first proposal", function () {
    it("should return the correct index to the winningProposal", async function () {
      await ballotContract.vote(0);
      expect(await ballotContract.winningProposal()).to.be.eq(0);
    });
  });

  describe("when someone interact with the winnerName function before any votes are cast", function () {
    it("should return the name of the proposal belonging to the default index(0)", async function () {
      const winningName = await ballotContract.winnerName();
      expect(ethers.utils.parseBytes32String(winningName)).to.be.eq(
        "Proposal 1"
      );
    });
  });

  describe("when someone interact with the winnerName function after one vote is cast for the first proposal", function () {
    it("should return the name of the voted for proposal(Proposal 1)", async function () {
      ballotContract.vote(0);
      const winningName = await ballotContract.winnerName();
      expect(ethers.utils.parseBytes32String(winningName)).to.be.eq(
        "Proposal 1"
      );
    });
  });

  describe("when someone interact with the winningProposal function and winnerName after 5 random votes are cast for the proposals", function () {
    it("(winningProposal) should return the index of the most voted for proposal", async function () {
      for (let i = 1; i < 5; i++) {
        await ballotContract.giveRightToVote(accounts[i].address);
      }

      await ballotContract.vote(2);
      await ballotContract.connect(accounts[1]).vote(1);
      await ballotContract.connect(accounts[2]).vote(2);
      await ballotContract.connect(accounts[3]).vote(0);
      await ballotContract.connect(accounts[4]).vote(2);

      expect(await ballotContract.winningProposal()).to.be.eq(2);
    });
    it("(winnerName) should return the name of the most voted for proposal", async function () {
      for (let i = 1; i < 5; i++) {
        await ballotContract.giveRightToVote(accounts[i].address);
      }

      await ballotContract.vote(2);
      await ballotContract.connect(accounts[1]).vote(1);
      await ballotContract.connect(accounts[2]).vote(2);
      await ballotContract.connect(accounts[3]).vote(0);
      await ballotContract.connect(accounts[4]).vote(2);

      const winningName = await ballotContract.winnerName();
      expect(ethers.utils.parseBytes32String(winningName)).to.be.eq(
        "Proposal 3"
      );
    });
  });
});
