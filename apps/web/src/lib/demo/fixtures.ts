/**
 * DEMO FIXTURES ONLY
 * These values are for layout demonstration. They are not live blockchain reads.
 * Do not treat them as settlement proof.
 */

export const DEMO_BANNER =
  "Demo UI · fixture data only · not live Whitechain reads · wallet/contract integration not enabled in this stage";

export const demoMerchant = {
  name: "Northwind Tools",
  address: "0xAE7168d00595a769C9434AB1ddE4D9F0273177CE",
  payoutAddress: "0xAE7168d00595a769C9434AB1ddE4D9F0273177CE",
  webhookUrl: "https://merchant.example/hooks/wf",
  active: true,
};

export const demoMetrics = {
  volumeSettledUsdt: 18450.0,
  successfulPayments: 42,
  pendingPayments: 3,
  refundsUsdt: 320.5,
  openIntents: 3,
};

export const demoVolumeSeries = [
  { day: "Oct 25", volume: 820 },
  { day: "Oct 26", volume: 1140 },
  { day: "Oct 27", volume: 960 },
  { day: "Oct 28", volume: 1480 },
  { day: "Oct 29", volume: 1220 },
  { day: "Oct 30", volume: 1710 },
  { day: "Oct 31", volume: 990 },
  { day: "Nov 1", volume: 1330 },
  { day: "Nov 2", volume: 1560 },
  { day: "Nov 3", volume: 1180 },
  { day: "Nov 4", volume: 1740 },
  { day: "Nov 5", volume: 1490 },
  { day: "Nov 6", volume: 1620 },
  { day: "Nov 7", volume: 1210 },
];

export type DemoIntentStatus =
  | "CREATED"
  | "SETTLED"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED"
  | "EXPIRED"
  | "CANCELLED";

export type DemoIntent = {
  id: string;
  orderRef: string;
  amountUsdt: number;
  status: DemoIntentStatus;
  payer: string | null;
  confirmationStage: "soft" | "safe" | "finalized" | null;
  createdAt: string;
  expiresAt: string;
  txHash: string | null;
  refundedUsdt: number;
};

export const demoIntents: DemoIntent[] = [
  {
    id: "12",
    orderRef: "PO-1042",
    amountUsdt: 25,
    status: "SETTLED",
    payer: "0x1111111111111111111111111111111111111111",
    confirmationStage: "safe",
    createdAt: "2026-11-06T10:12:00Z",
    expiresAt: "2026-11-06T10:42:00Z",
    txHash: "0xaaa111aaa111aaa111aaa111aaa111aaa111aaa111aaa111aaa111aaa111aaa1",
    refundedUsdt: 0,
  },
  {
    id: "13",
    orderRef: "PO-1043",
    amountUsdt: 180,
    status: "CREATED",
    payer: null,
    confirmationStage: null,
    createdAt: "2026-11-07T08:00:00Z",
    expiresAt: "2026-11-07T08:30:00Z",
    txHash: null,
    refundedUsdt: 0,
  },
  {
    id: "14",
    orderRef: "INV-88",
    amountUsdt: 420.5,
    status: "PARTIALLY_REFUNDED",
    payer: "0x2222222222222222222222222222222222222222",
    confirmationStage: "finalized",
    createdAt: "2026-11-05T16:20:00Z",
    expiresAt: "2026-11-05T16:50:00Z",
    txHash: "0xbbb222bbb222bbb222bbb222bbb222bbb222bbb222bbb222bbb222bbb222bbb2",
    refundedUsdt: 100,
  },
  {
    id: "15",
    orderRef: "PO-1039",
    amountUsdt: 64,
    status: "EXPIRED",
    payer: null,
    confirmationStage: null,
    createdAt: "2026-11-04T09:00:00Z",
    expiresAt: "2026-11-04T09:30:00Z",
    txHash: null,
    refundedUsdt: 0,
  },
  {
    id: "16",
    orderRef: "PO-1040",
    amountUsdt: 90,
    status: "REFUNDED",
    payer: "0x3333333333333333333333333333333333333333",
    confirmationStage: "finalized",
    createdAt: "2026-11-03T14:10:00Z",
    expiresAt: "2026-11-03T14:40:00Z",
    txHash: "0xccc333ccc333ccc333ccc333ccc333ccc333ccc333ccc333ccc333ccc333ccc3",
    refundedUsdt: 90,
  },
];

export type DemoInvoiceStatus =
  | "CREATED"
  | "BUYER_CONFIRMED"
  | "CANCELLED"
  | "SETTLED"
  | "EXPIRED";

export type DemoInvoice = {
  id: string;
  number: string;
  seller: string;
  buyer: string;
  faceValueUsdt: number;
  dueDate: string;
  status: DemoInvoiceStatus;
  documentHash: string;
  sellerFinancingId: string | null;
  buyerFinancingId: string | null;
  outstandingToSeller: number;
  investorReceivable: number;
};

export const demoInvoices: DemoInvoice[] = [
  {
    id: "1",
    number: "NW-2026-01",
    seller: demoMerchant.address,
    buyer: "0x4444444444444444444444444444444444444444",
    faceValueUsdt: 100000,
    dueDate: "2026-12-15",
    status: "BUYER_CONFIRMED",
    documentHash: "0xdoc111doc111doc111doc111doc111doc111doc111doc111doc111doc111doc1",
    sellerFinancingId: "1",
    buyerFinancingId: null,
    outstandingToSeller: 0,
    investorReceivable: 100000,
  },
  {
    id: "2",
    number: "NW-2026-02",
    seller: demoMerchant.address,
    buyer: "0x5555555555555555555555555555555555555555",
    faceValueUsdt: 48000,
    dueDate: "2026-11-30",
    status: "CREATED",
    documentHash: "0xdoc222doc222doc222doc222doc222doc222doc222doc222doc222doc222doc2",
    sellerFinancingId: null,
    buyerFinancingId: null,
    outstandingToSeller: 48000,
    investorReceivable: 0,
  },
  {
    id: "3",
    number: "NW-2026-03",
    seller: demoMerchant.address,
    buyer: "0x6666666666666666666666666666666666666666",
    faceValueUsdt: 25000,
    dueDate: "2026-11-20",
    status: "BUYER_CONFIRMED",
    documentHash: "0xdoc333doc333doc333doc333doc333doc333doc333doc333doc333doc333doc3",
    sellerFinancingId: null,
    buyerFinancingId: "2",
    outstandingToSeller: 17500,
    investorReceivable: 7875,
  },
];

export type DemoFinancingStatus =
  | "REQUESTED"
  | "ACTIVE"
  | "REPAID"
  | "OVERDUE"
  | "DEFAULTED"
  | "DISPUTED"
  | "CANCELLED"
  | "EXPIRED";

export type DemoSellerFinancing = {
  id: string;
  type: "seller";
  invoiceId: string;
  invoiceNumber: string;
  faceValueUsdt: number;
  advanceUsdt: number;
  discountUsdt: number;
  expectedGrossRepaymentUsdt: number;
  dueDate: string;
  status: DemoFinancingStatus;
  seller: string;
  buyer: string;
  investor: string | null;
};

export type DemoBuyerFinancing = {
  id: string;
  type: "buyer";
  invoiceId: string;
  invoiceNumber: string;
  faceValueUsdt: number;
  principalUsdt: number;
  feeUsdt: number;
  sellerRemainderUsdt: number;
  expectedGrossRepaymentUsdt: number;
  dueDate: string;
  status: DemoFinancingStatus;
  seller: string;
  buyer: string;
  investor: string | null;
};

export const demoSellerFinancing: DemoSellerFinancing[] = [
  {
    id: "1",
    type: "seller",
    invoiceId: "1",
    invoiceNumber: "NW-2026-01",
    faceValueUsdt: 100000,
    advanceUsdt: 95000,
    discountUsdt: 5000,
    expectedGrossRepaymentUsdt: 100000,
    dueDate: "2026-12-15",
    status: "ACTIVE",
    seller: demoMerchant.address,
    buyer: "0x4444444444444444444444444444444444444444",
    investor: "0x7777777777777777777777777777777777777777",
  },
  {
    id: "3",
    type: "seller",
    invoiceId: "4",
    invoiceNumber: "NW-2026-04",
    faceValueUsdt: 12000,
    advanceUsdt: 11400,
    discountUsdt: 600,
    expectedGrossRepaymentUsdt: 12000,
    dueDate: "2026-11-18",
    status: "REQUESTED",
    seller: demoMerchant.address,
    buyer: "0x8888888888888888888888888888888888888888",
    investor: null,
  },
];

export const demoBuyerFinancing: DemoBuyerFinancing[] = [
  {
    id: "2",
    type: "buyer",
    invoiceId: "3",
    invoiceNumber: "NW-2026-03",
    faceValueUsdt: 25000,
    principalUsdt: 7500,
    feeUsdt: 375,
    sellerRemainderUsdt: 17500,
    expectedGrossRepaymentUsdt: 7875,
    dueDate: "2026-11-20",
    status: "ACTIVE",
    seller: demoMerchant.address,
    buyer: "0x6666666666666666666666666666666666666666",
    investor: "0x7777777777777777777777777777777777777777",
  },
  {
    id: "4",
    type: "buyer",
    invoiceId: "5",
    invoiceNumber: "ACME-9",
    faceValueUsdt: 18000,
    principalUsdt: 6000,
    feeUsdt: 240,
    sellerRemainderUsdt: 12000,
    expectedGrossRepaymentUsdt: 6240,
    dueDate: "2026-11-25",
    status: "REQUESTED",
    seller: "0x9999999999999999999999999999999999999999",
    buyer: "0x6666666666666666666666666666666666666666",
    investor: null,
  },
];

export const demoActivity = [
  {
    id: "a1",
    type: "payment.settled",
    label: "Payment settled",
    detail: "PO-1042 · 25.00 USDT",
    at: "2026-11-06T10:15:22Z",
  },
  {
    id: "a2",
    type: "invoice.confirmed",
    label: "Invoice confirmed",
    detail: "NW-2026-01",
    at: "2026-11-05T18:02:11Z",
  },
  {
    id: "a3",
    type: "financing.funded",
    label: "Seller financing funded",
    detail: "Advance 95,000 USDT",
    at: "2026-11-05T19:40:00Z",
  },
  {
    id: "a4",
    type: "payment.refunded",
    label: "Partial refund",
    detail: "INV-88 · 100.00 USDT",
    at: "2026-11-05T17:01:00Z",
  },
];

export const demoBusinesses = [
  {
    address: demoMerchant.address,
    name: "Northwind Tools",
    roles: "Merchant · Seller",
    active: true,
  },
  {
    address: "0x7777777777777777777777777777777777777777",
    name: "Harbor Capital",
    roles: "Investor",
    active: true,
  },
  {
    address: "0x6666666666666666666666666666666666666666",
    name: "Blue Harbor Retail",
    roles: "Buyer",
    active: true,
  },
];

export const demoRelayer = {
  paused: false,
  address: "0xRELAYER00000000000000000000000000000001",
  wbtBalance: "0.42",
  budgetRemainingWei: "82000000000000000",
};

export const PRIZE_USDT = "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7";
export const PAYMENT_PROCESSOR = "0xC210Cff48e44edA690E0149C98250e3eb40aaDe5";

export function getDemoIntent(id: string) {
  return demoIntents.find((i) => i.id === id) ?? null;
}

export function getDemoInvoice(id: string) {
  return demoInvoices.find((i) => i.id === id) ?? null;
}

export function getDemoSellerFinancing(id: string) {
  return demoSellerFinancing.find((i) => i.id === id) ?? null;
}

export function getDemoBuyerFinancing(id: string) {
  return demoBuyerFinancing.find((i) => i.id === id) ?? null;
}
