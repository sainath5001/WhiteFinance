// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IEscrowVault {
    function openAccount(bytes32 accountId, address depositor, address beneficiary) external;
    function depositFrom(bytes32 accountId, address from, uint256 amount) external;
    function release(bytes32 accountId) external returns (uint256 amount);
    function refund(bytes32 accountId) external returns (uint256 amount);
    function held(bytes32 accountId) external view returns (uint256);
    function totalHeld() external view returns (uint256);
}
