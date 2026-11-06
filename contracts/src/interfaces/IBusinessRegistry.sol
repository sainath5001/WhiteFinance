// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Types} from "../libraries/Types.sol";

interface IBusinessRegistry {
    function getBusiness(address account) external view returns (Types.Business memory);
    function isActive(address account) external view returns (bool);
    function hasBusinessRole(address account, uint8 role) external view returns (bool);
    function payoutAddress(address account) external view returns (address);
}
