# Tenstorrent sharded mask research - no automatic bounty claim

Pure-Python mask validation logic and tests exist in full lab ZIP core/tenstorrent_mask.py. It models orientation, causal row-major rejection, batch broadcast and mask-height wrapping. Those tests are NOT Tenstorrent hardware tests or a tt-metal PR.

Issue https://github.com/tenstorrent/tt-metal/issues/64647 already has competing PR https://github.com/tenstorrent/tt-metal/pull/64731. Tenstorrent terms require human assignment and merged accepted code; do not file a bot claim, auto-assign, or copy the other PR. Original work can proceed as independent simulations and negative test design. No payout or assignment claimed.
