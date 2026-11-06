export const DEMO_ROLES = [
  "merchant",
  "seller",
  "buyer",
  "investor",
  "admin",
] as const;

export type DemoRole = (typeof DEMO_ROLES)[number];

export const ROLE_HOME: Record<DemoRole, string> = {
  merchant: "/app/merchant",
  seller: "/app/seller",
  buyer: "/app/buyer",
  investor: "/app/investor",
  admin: "/app/admin",
};

export const ROLE_LABEL: Record<DemoRole, string> = {
  merchant: "Merchant",
  seller: "Seller",
  buyer: "Buyer",
  investor: "Investor",
  admin: "Admin",
};

export const ROLE_STORAGE_KEY = "wf_demo_role";
