// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;
import {Test} from "forge-std/Test.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {ElgoraHub} from "../src/ElgoraHub.sol";
import {CappedSubmissionGuard} from "../src/CappedSubmissionGuard.sol";
import {WinnerTakesAllPayoutScheme} from "../src/WinnerTakesAllPayoutScheme.sol";

// Ordinary exact-transfer token, local only. Mint only during actor setup.
contract ExactLocalUSDC is ERC20 {
    address immutable fixture = msg.sender;
    constructor() ERC20("Local USDC", "USDC") {}
    function decimals() public pure override returns (uint8) {return 6;}
    function mint(address to,uint256 value) external {require(msg.sender==fixture);_mint(to,value);}
}

contract ToyolReferenceAccountingTest is Test {
    ExactLocalUSDC token;
    ElgoraHub hub;
    CappedSubmissionGuard guard;
    WinnerTakesAllPayoutScheme scheme;
    address constant TRUSTED = address(0x1001);
    address constant COORD = address(0x1002);
    address constant G1 = address(0x2001);
    address constant G2 = address(0x2002);
    address constant G3 = address(0x2003);
    address constant POSTER = address(0x3001);
    address constant WINNER = address(0x3002);
    address constant OTHER = address(0x3003);
    bytes32 constant SPEC = keccak256("local spec");
    bytes32 constant SUB = keccak256("honest submission");
    bytes32 constant REPORT = keccak256("honest verdict");
    uint64 deadline;
    function setUp() public {
        vm.warp(1794017308);
        token = new ExactLocalUSDC();
        guard = new CappedSubmissionGuard(TRUSTED,10);
        scheme = new WinnerTakesAllPayoutScheme();
        ElgoraHub.Guardian[] memory roster = new ElgoraHub.Guardian[](3);
        roster[0]=ElgoraHub.Guardian("G1",G1,"local-key-one");
        roster[1]=ElgoraHub.Guardian("G2",G2,"local-key-two");
        roster[2]=ElgoraHub.Guardian("G3",G3,"local-key-three");
        hub = new ElgoraHub(IERC20(address(token)), TRUSTED,
            ElgoraHub.InitialConfig({
                guardianRosterAdmin:TRUSTED, guardianReviewWindow:259200,
                treasuryRecipient:TRUSTED,guardianFeeRecipient:TRUSTED,
                treasuryFeeBps:0,guardianFeeBps:1000,
                minimumEscrowAmount:20e6,maximumEscrowAmount:250e6,
                minBountyDuration:259200,maxBountyDuration:5184000,
                submissionGuard:address(guard),payoutScheme:address(scheme),
                coordinator:COORD,coordinatorGracePeriod:3600
            }),roster);
        vm.prank(TRUSTED); guard.bindHub(address(hub));
        assertEq(hub.owner(),TRUSTED);
        assertEq(guard.owner(),TRUSTED);
        assertEq(guard.hub(),address(hub));
        assertEq(hub.bountyCount(),0);
        assertEq(token.balanceOf(address(hub)),0);
        assertFalse(hub.paused());
        assertFalse(hub.pausingDisabled());
        deadline=uint64(block.timestamp+259200);
    }
    function fund(uint256 a) internal returns(uint256 id){
        token.mint(POSTER,a);
        vm.startPrank(POSTER);
        token.approve(address(hub),a);
        id=hub.createBounty(SPEC,a,deadline);
        vm.stopPrank();
        assertEq(hub.guardianThreshold(id),2);
        assertEq(hub.judgingDeadlineAt(id),deadline+129600);
        assertEq(hub.settlementTimeoutAt(id),deadline+259200);
    }
    function vote(uint256 id,bool award) internal {
        ElgoraHub.Outcome outcome=award?ElgoraHub.Outcome.Awarded:ElgoraHub.Outcome.NoValidSubmission;
        address recipient=award?WINNER:address(0);
        bytes32 submission=award?SUB:bytes32(0);
        vm.prank(G1); hub.commitVerdict(id,outcome,recipient,submission,REPORT,"");
        vm.prank(G2); hub.commitVerdict(id,outcome,recipient,submission,REPORT,"");
    }
    function assertBalance(uint256 expected) internal view{
        assertEq(token.balanceOf(address(hub)),expected,"independent obligations");
    }
    function testFuzz_MixedLifecycleConservation(uint64 aSeed,uint64 bSeed,uint64 cSeed,uint64 dSeed,bool feesFirst) public {
        uint256 a=bound(aSeed,20e6,250e6);
        uint256 b=bound(bSeed,20e6,250e6);
        uint256 c=bound(cSeed,20e6,250e6);
        uint256 d=bound(dSeed,20e6,250e6);
        fund(a);fund(b);fund(c);fund(d);
        assertBalance(a+b+c+d);
        bytes32 rosterHash=hub.guardianRosterHash();
        vm.prank(WINNER);hub.submit(0,SUB,rosterHash,"");
        vm.prank(OTHER);hub.submit(1,keccak256("invalid work"),rosterHash,"");
        // No privileged cooperation: truthful votes after submission closes.
        vm.warp(deadline);
        vote(0,true);vote(1,false);vote(2,false);
        vm.warp(deadline+129600);
        vm.prank(OTHER);vm.expectRevert(ElgoraHub.NotCoordinator.selector);hub.settle(0);
        vm.prank(COORD);hub.settle(0);
        vm.prank(COORD);hub.settle(1);
        vm.prank(COORD);hub.settle(2);
        uint256 feeA=a/10;uint256 feeB=b/10;
        assertEq(hub.guardianFeeClaimable(),feeA+feeB);
        assertEq(hub.treasuryFeeClaimable(),0);
        assertEq(hub.claimable(1,POSTER),b-feeB);
        assertEq(hub.claimable(2,POSTER),c);
        assertBalance(a+b+c+d);
        // A non-winner cannot take the award or fees.
        vm.prank(OTHER);vm.expectRevert(ElgoraHub.NothingToClaim.selector);hub.claimAward(0,"");
        vm.prank(OTHER);vm.expectRevert(ElgoraHub.NothingToClaim.selector);hub.claimFees();
        if(feesFirst){vm.prank(TRUSTED);hub.claimFees();assertBalance(a+b+c+d-feeA-feeB);}
        vm.prank(WINNER);hub.claimAward(0,"");
        assertEq(token.balanceOf(WINNER),a-feeA);
        vm.prank(WINNER);vm.expectRevert(ElgoraHub.NothingToClaim.selector);hub.claimAward(0,"");
        vm.warp(deadline+259200);
        vm.prank(OTHER);hub.timeoutSettlement(3);
        assertEq(hub.claimable(3,POSTER),d);
        // Duplicate bounty IDs and unallocated IDs cannot pay twice.
        uint256[] memory ids=new uint256[](6);
        ids[0]=1;ids[1]=2;ids[2]=1;ids[3]=3;ids[4]=3;ids[5]=999;
        vm.prank(POSTER);hub.claimMany(ids);
        assertEq(token.balanceOf(POSTER),b-feeB+c+d);
        if(!feesFirst){assertBalance(feeA+feeB);vm.prank(TRUSTED);hub.claimFees();}
        assertEq(token.balanceOf(TRUSTED),feeA+feeB);
        assertBalance(0);
        assertEq(hub.guardianFeeClaimable(),0);
        assertEq(hub.winnerPoolClaimed(0),a-feeA);
    }
    function testSeatCapAndRevisionDoesNotConsumeAnotherSeat() public {
        fund(20e6);
        bytes32 roster=hub.guardianRosterHash();
        for(uint160 i=1;i<=10;i++){
            address solver=address(0x5000+i);
            vm.prank(solver);hub.submit(0,keccak256(abi.encode(i)),roster,"");
        }
        assertEq(guard.remainingSubmissions(0),0);
        vm.prank(address(0x5001));hub.submit(0,SUB,roster,"");
        assertEq(guard.submissionSeatsUsed(0),10);
        vm.prank(OTHER);vm.expectRevert(ElgoraHub.SubmissionRejected.selector);hub.submit(0,SUB,roster,"");
        assertBalance(20e6);
        vm.warp(deadline+259200);
        hub.timeoutSettlement(0);
        vm.prank(POSTER);hub.claim(0);
        assertBalance(0);
    }

    function testDeadlineEdgesAndPermissionlessSettlement() public {
        fund(20e6);
        bytes32 roster=hub.guardianRosterHash();
        vm.warp(deadline-1);
        vm.prank(WINNER);hub.submit(0,SUB,roster,"");
        vm.warp(deadline);
        vm.prank(OTHER);vm.expectRevert(ElgoraHub.DeadlinePassed.selector);hub.submit(0,SUB,roster,"");
        vote(0,true);
        vm.warp(deadline+129599);
        vm.prank(COORD);vm.expectRevert(ElgoraHub.DeadlineNotPassed.selector);hub.settle(0);
        vm.warp(deadline+129600);
        vm.prank(G1);vm.expectRevert(ElgoraHub.JudgingDeadlinePassed.selector);
        hub.commitVerdict(0,ElgoraHub.Outcome.Awarded,WINNER,SUB,REPORT,"");
        vm.prank(OTHER);vm.expectRevert(ElgoraHub.NotCoordinator.selector);hub.settle(0);
        vm.warp(deadline+129600+3599);
        vm.prank(OTHER);vm.expectRevert(ElgoraHub.NotCoordinator.selector);hub.settle(0);
        vm.warp(deadline+129600+3600);
        vm.prank(OTHER);hub.settle(0);
        assertEq(uint8(hub.status(0)),uint8(ElgoraHub.Status.Awarded));
        assertEq(hub.winner(0),WINNER);
        assertEq(hub.guardianFeeClaimable(),2e6);
        assertBalance(20e6);
        vm.prank(WINNER);hub.claimAward(0,"");
        assertBalance(2e6);
        vm.prank(TRUSTED);hub.claimFees();
        assertBalance(0);
    }
    function testTimeoutBoundaryCannotPayBothAwardAndRefund() public {
        fund(36e6);
        bytes32 roster=hub.guardianRosterHash();
        vm.prank(WINNER);hub.submit(0,SUB,roster,"");
        vm.warp(deadline);vote(0,true);
        vm.warp(deadline+259199);
        vm.expectRevert(ElgoraHub.DeadlineNotPassed.selector);hub.timeoutSettlement(0);
        // No settlement was made; documented full poster refund after timeout.
        vm.warp(deadline+259200);
        vm.prank(COORD);vm.expectRevert(ElgoraHub.SettlementWindowExpired.selector);hub.settle(0);
        vm.prank(OTHER);hub.timeoutSettlement(0);
        assertEq(hub.claimable(0,POSTER),36e6);
        assertEq(hub.guardianFeeClaimable(),0);
        vm.prank(WINNER);vm.expectRevert(ElgoraHub.InvalidStatus.selector);hub.claimAward(0,"");
        vm.expectRevert(ElgoraHub.InvalidStatus.selector);hub.timeoutSettlement(0);
        vm.prank(POSTER);hub.claim(0);
        assertEq(token.balanceOf(POSTER),36e6);
        assertBalance(0);
    }
    function testOrdinaryActorCannotAlterRolesOrVerdicts() public {
        fund(25e6);
        bytes32 roster=hub.guardianRosterHash();
        vm.startPrank(OTHER);
        // Check rejection without assuming a particular Ownable version's error encoding.
        vm.expectRevert();hub.setCoordinator(OTHER);
        vm.expectRevert();hub.setSubmissionGuard(OTHER);
        vm.expectRevert();hub.setPayoutScheme(OTHER);
        vm.expectRevert();hub.setGuardianRosterAdmin(OTHER);
        vm.expectRevert();hub.pause();
        vm.expectRevert();hub.disablePauseAuthority();
        vm.expectRevert();guard.setDefaultMaximumSubmissions(100);
        vm.expectRevert();guard.setBountyMaximumSubmissions(0,100);
        vm.expectRevert();guard.bindHub(address(hub));
        vm.expectRevert(ElgoraHub.NotGuardianRosterAdmin.selector);hub.removeGuardian(G1);
        vm.expectRevert(ElgoraHub.NotRosterGuardian.selector);
        hub.commitVerdict(0,ElgoraHub.Outcome.Awarded,OTHER,SUB,REPORT,"");
        vm.expectRevert(ElgoraHub.StaleGuardianRoster.selector);hub.submit(0,SUB,bytes32(uint256(1)),"");
        vm.stopPrank();
        assertEq(hub.guardianRosterHash(),roster);
        assertEq(hub.owner(),TRUSTED);
        assertEq(hub.coordinator(),COORD);
        assertEq(address(hub.payoutScheme()),address(scheme));
        assertEq(address(hub.submissionGuard()),address(guard));
        assertEq(guard.submissionSeatsUsed(0),0);
        assertEq(hub.activeSubmissionCommitment(0,OTHER),bytes32(0));
        assertFalse(hub.paused());
        assertBalance(25e6);
    }
    function testFundingBoundsAndRejectedFundingLeavesNoLiability() public {
        token.mint(POSTER,251e6);
        vm.startPrank(POSTER);
        token.approve(address(hub),251e6);
        vm.expectRevert(ElgoraHub.InvalidEscrowAmount.selector);hub.createBounty(SPEC,20e6-1,deadline);
        vm.expectRevert(ElgoraHub.InvalidEscrowAmount.selector);hub.createBounty(SPEC,250e6+1,deadline);
        vm.expectRevert(ElgoraHub.InvalidCommitment.selector);hub.createBounty(bytes32(0),20e6,deadline);
        vm.expectRevert(ElgoraHub.InvalidDeadline.selector);hub.createBounty(SPEC,20e6,deadline-1);
        vm.expectRevert(ElgoraHub.InvalidDeadline.selector);hub.createBounty(SPEC,20e6,uint64(block.timestamp+5184001));
        token.approve(address(hub),19e6);
        vm.expectRevert();hub.createBounty(SPEC,20e6,deadline);
        vm.stopPrank();
        assertEq(hub.bountyCount(),0);
        assertEq(token.balanceOf(POSTER),251e6);
        assertBalance(0);
        fund(20e6);
        assertBalance(20e6);
    }

}
