// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// EDUCATIONAL ONLY. No deployed contract, fundraising, token marketing or audited production use.
// Build against @openzeppelin/contracts 5.6.1; do not copy ERC-20 accounting from scratch.
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Capped} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/** A local educational token; the owner controls issuance until its chosen cap. */
contract ToyolLabToken is ERC20, ERC20Burnable, ERC20Capped, Ownable2Step {
    constructor(address initialOwner, uint256 initialSupply, uint256 cap_)
        ERC20("Toyol Lab Test Token", "TLAB")
        ERC20Capped(cap_)
        Ownable(initialOwner)
    {
        _mint(initialOwner, initialSupply);
    }

    /** Only the owner may mint; ERC20Capped rejects exceeding cap. */
    function mint(address receiver, uint256 tokens) external onlyOwner {
        _mint(receiver, tokens);
    }

    /** Resolve inheritance and apply the supply cap on mint operations. */
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Capped)
    {
        super._update(from, to, value);
    }
}
