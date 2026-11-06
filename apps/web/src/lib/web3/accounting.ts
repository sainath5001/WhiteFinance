/**
 * Pure accounting helpers aligned with WhiteFinance business rules.
 * Never treat outputs as guaranteed profit.
 */

export function sellerFactoringPreview(face: bigint, advance: bigint, discount: bigint) {
  return {
    face,
    advance,
    discount,
    expectedGrossRepaymentToInvestor: face,
    investorProfitIfRepaid: discount,
    invariantOk: advance + discount === face,
    disclaimer: "Expected gross repayment equals face value. Not a guaranteed return.",
  };
}

export function buyerFinancingPreview(face: bigint, principal: bigint, fee: bigint) {
  const sellerRemainder = face - principal;
  return {
    face,
    principalPaidToSeller: principal,
    sellerRemainder,
    fee,
    buyerObligationToInvestor: principal + fee,
    invariantOk: principal + sellerRemainder === face && principal < face && fee >= 0n,
    disclaimer:
      "Principal paid to seller extinguishes that slice. Do not also count it as still owed to seller.",
  };
}
