// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Types} from "../libraries/Types.sol";

interface IInvoiceRegistry {
    function getInvoice(uint256 invoiceId) external view returns (Types.Invoice memory);

    function attachSellerFinancing(uint256 invoiceId, uint256 financingId) external;
    function attachBuyerFinancing(uint256 invoiceId, uint256 financingId) external;
    function detachFinancing(uint256 invoiceId, bool sellerSide) external;

    function onSellerFactoringFunded(uint256 invoiceId) external;
    function onBuyerFinancingFunded(uint256 invoiceId, uint256 principal, uint256 investorReceivable) external;
    function onRemainderPaid(uint256 invoiceId, uint256 amount) external;
    function onInvestorRepaid(uint256 invoiceId, uint256 amount) external;
}
