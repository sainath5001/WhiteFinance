// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Errors} from "../libraries/Errors.sol";

/// @notice Test token that mirrors prize USDT EIP-3009 rules: exclusive time bounds, receive-to-self, blocklist.
contract MockPrizeUSDT is ERC20, EIP712 {
    bytes32 public constant RECEIVE_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );
    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    mapping(address => bool) public isBlocked;
    mapping(address => mapping(bytes32 => bool)) public authorizationState;

    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);
    event BlockPlaced(address indexed user);

    constructor() ERC20("Tether USD", "USDT") EIP712("Tether USD", "1") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setBlocked(address account, bool blocked) external {
        isBlocked[account] = blocked;
        if (blocked) emit BlockPlaced(account);
    }

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function hashReceiveAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce
    ) external view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(abi.encode(RECEIVE_WITH_AUTHORIZATION_TYPEHASH, from, to, value, validAfter, validBefore, nonce))
        );
    }

    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes calldata signature
    ) external {
        _requireValidAuthorization(from, to, value, validAfter, validBefore, nonce, signature, true);
        _transfer(from, to, value);
    }

    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        _requireValidAuthorization(from, to, value, validAfter, validBefore, nonce, abi.encodePacked(r, s, v), true);
        _transfer(from, to, value);
    }

    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes calldata signature
    ) external {
        _requireValidAuthorization(from, to, value, validAfter, validBefore, nonce, signature, false);
        _transfer(from, to, value);
    }

    function _requireValidAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes memory signature,
        bool receiveAuth
    ) internal {
        if (isBlocked[msg.sender] || isBlocked[from]) revert Errors.TokenBlocked();
        if (receiveAuth && to != msg.sender) revert Errors.WrongTokenRecipient();
        if (block.timestamp <= validAfter) revert Errors.AuthorizationEarly();
        if (block.timestamp >= validBefore) revert Errors.AuthorizationExpired();
        if (authorizationState[from][nonce]) revert Errors.AuthorizationNonceUsed();

        bytes32 typehash = receiveAuth ? RECEIVE_WITH_AUTHORIZATION_TYPEHASH : TRANSFER_WITH_AUTHORIZATION_TYPEHASH;
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(typehash, from, to, value, validAfter, validBefore, nonce)));
        address signer = ECDSA.recover(digest, signature);
        if (signer != from) revert Errors.InvalidAuthorization();

        authorizationState[from][nonce] = true;
        emit AuthorizationUsed(from, nonce);
    }

    function _update(address from, address to, uint256 value) internal virtual override {
        if (to == address(this)) revert Errors.TransferToTokenContract();
        if (from != address(0) && isBlocked[from]) revert Errors.TokenBlocked();
        super._update(from, to, value);
    }
}
