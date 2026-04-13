module.exports = {
  PERMISSION: {
    VIEW_DASHBOARD: {
      name: 'VIEW_ROLE_PERMISSION_DASHBOARD',
      description: 'View comprehensive role-permission dashboard data',
    },
    VIEW_ALL: {
      name: 'VIEW_ALL_PERMISSIONS',
      description: 'View all permissions',
    },
    DELETE: {
      name: 'DELETE_PERMISSION',
      description: 'Delete permission by ID',
    },
  },
  ROLE: {
    CREATE: { name: 'CREATE_ROLE', description: 'Create new role' },
    VIEW_ALL: { name: 'VIEW_ALL_ROLES', description: 'View all roles' },
    VIEW: { name: 'VIEW_ROLE', description: 'View role by ID' },
    UPDATE: { name: 'UPDATE_ROLE', description: 'Update role' },
    DELETE: { name: 'DELETE_ROLE', description: 'Delete role' },
  },

  ROLE_PERMISSION: {
    CREATE: {
      name: 'CREATE_ROLE_PERMISSION',
      description: 'Create role-permission link',
    },
    ASSIGN: {
      name: 'ASSIGN_ROLE_PERMISSIONS',
      description: 'Assign permissions to role',
    },
    VIEW_ALL: {
      name: 'VIEW_ALL_ROLE_PERMISSIONS',
      description: 'View all role-permission relationships',
    },
    DELETE: {
      name: 'DELETE_ROLE_PERMISSION',
      description: 'Delete role-permission by ID',
    },
  },

  Employee: {
    VIEW_DASHBOARD: {
      name: 'VIEW_Users_DASHBOARD',
      description: 'View comprehensive inventory dashboard data',
    },
    CREATE: {
      name: 'CREATE_Employee',
      description: 'Register or create new Employee accounts',
    },
    VIEW: {
      name: 'VIEW_Employee', // For viewing a single employee
      description: 'View specific Employee details',
    },
    VIEW_ALL: {
      name: 'VIEW_ALL_EMPLOYEES', // Changed to be unique
      description: 'View all Employee in the system',
    },
    UPDATE: {
      name: 'UPDATE_Employee',
      description: 'Update existing Employee information',
    },
    DELETE: {
      name: 'DELETE_Employee',
      description: 'Delete Employee accounts',
    },
    CHANGE_PASSWORD: {
      name: 'CHANGE_USER_PASSWORD',
      description: 'Change password for user accounts',
    },
  },

  COMPANY: {
    CREATE: { name: 'CREATE_COMPANY', description: 'Create new companies' },
    VIEW: { name: 'VIEW_COMPANY', description: 'View company details' },
    UPDATE: {
      name: 'UPDATE_COMPANY',
      description: 'Update company information',
    },
    DELETE: { name: 'DELETE_COMPANY', description: 'Delete companies' },
  },
  SUPPLIER: {
    CREATE: {
      name: 'CREATE_SUPPLIER',
      description: 'Create a new supplier',
    },
    VIEW: {
      name: 'VIEW_SUPPLIER',
      description: 'View a specific supplier',
    },
    VIEW_ALL: {
      name: 'VIEW_ALL_SUPPLIERS',
      description: 'View all suppliers',
    },
    UPDATE: {
      name: 'UPDATE_SUPPLIER',
      description: 'Update a supplier',
    },
    DELETE: {
      name: 'DELETE_SUPPLIER',
      description: 'Delete a supplier',
    },
  },
  CUSTOMER: {
    CREATE: { name: 'CREATE_CUSTOMER', description: 'Create new customers' },
    VIEW_ALL: { name: 'VIEW_ALL_CUSTOMERS', description: 'View all customers' },
    UPDATE: {
      name: 'UPDATE_CUSTOMER',
      description: 'Update customer information',
    },
    DELETE: { name: 'DELETE_CUSTOMER', description: 'Delete customers' },
  },
  BRANCH: {
    VIEW_DASHBOARD: {
      name: 'VIEW_SYSTEM_DASHBOARD',
      description: 'View comprehensive system dashboard data',
    },
    CREATE: { name: 'CREATE_BRANCH', description: 'Create new branches' },
    VIEW_ALL: { name: 'VIEW_ALL_BRANCHES', description: 'View all branches' },
    UPDATE: { name: 'UPDATE_BRANCH', description: 'Update branch information' },
    DELETE: { name: 'DELETE_BRANCH', description: 'Delete branches' },
  },
  SHOP: {
    CREATE: { name: 'CREATE_SHOP', description: 'Create new shops' },
    VIEW_ALL: { name: 'VIEW_ALL_SHOPS', description: 'View all shops' },
    UPDATE: { name: 'UPDATE_SHOP', description: 'Update shop information' },
    DELETE: { name: 'DELETE_SHOP', description: 'Delete shops' },
  },
  STORE: {
    CREATE: { name: 'CREATE_STORE', description: 'Create new stores' },
    VIEW_ALL: { name: 'VIEW_ALL_STORES', description: 'View all stores' },
    UPDATE: { name: 'UPDATE_STORE', description: 'Update store information' },
    DELETE: { name: 'DELETE_STORE', description: 'Delete stores' },
  },
  CATEGORY: {
    CREATE: { name: 'CREATE_CATEGORY', description: 'Create new categories' },
    VIEW_ALL: {
      name: 'VIEW_ALL_CATEGORIES',
      description: 'View all categories',
    },
    UPDATE: {
      name: 'UPDATE_CATEGORY',
      description: 'Update category information',
    },
    DELETE: { name: 'DELETE_CATEGORY', description: 'Delete categories' },
  },
  PRODUCT: {
    VIEW_DASHBOARD: {
      name: 'VIEW_PRODUCT_DASHBOARD',
      description: 'View comprehensive product dashboard data',
    },
    CREATE: {
      name: 'CREATE_PRODUCT',
      description: 'Create new product',
    },
    VIEW_ALL: {
      name: 'VIEW_PRODUCT_ALL',
      description: 'View all product details',
    },
    LIST: {
      name: 'LIST_PRODUCTS',
      description: 'View list of all products',
    },
    UPDATE: {
      name: 'UPDATE_PRODUCT',
      description: 'Update product information',
    },
    DELETE: {
      name: 'DELETE_PRODUCT',
      description: 'Delete product',
    },
    VIEW: {
      name: 'VIEW',
      description: 'View product details',
    },
  },


  TRANSFER: {
    CREATE: {
      name: 'CREATE_TRANSFER',
      description: 'Create a new transfer between stores/shops',
    },
    VIEW: {
      name: 'VIEW_TRANSFER',
      description: 'View a specific transfer',
    },
    VIEW_ALL: {
      name: 'VIEW_ALL_TRANSFERS',
      description: 'View all transfers',
    },
    UPDATE: {
      name: 'UPDATE_TRANSFER',
      description: 'Update a transfer',
    },
    COMPLETE: {
      name: 'COMPLETE_TRANSFER',
      description: 'Complete a transfer (move stock)',
    },
    CANCEL: {
      name: 'CANCEL_TRANSFER',
      description: 'Cancel a transfer',
    },
    DELETE: {
      name: 'DELETE_TRANSFER',
      description: 'Delete a transfer',
    },
  },

  STOCK_CORRECTION: {
    CREATE: {
      name: 'CREATE_STOCK_CORRECTION',
      description: 'Create a new stock correction entry',
    },
    VIEW: {
      name: 'VIEW_STOCK_CORRECTION',
      description: 'View a specific stock correction',
    },
    VIEW_ALL: {
      name: 'VIEW_ALL_STOCK_CORRECTIONS',
      description: 'View all stock corrections',
    },
    UPDATE: {
      name: 'UPDATE_STOCK_CORRECTION',
      description: 'Update a stock correction',
    },
    APPROVE: {
      name: 'APPROVE_STOCK_CORRECTION',
      description: 'Approve a stock correction to adjust stock',
    },
    REJECT: {
      name: 'REJECT_STOCK_CORRECTION',
      description: 'Reject a stock correction request',
    },
    DELETE: {
      name: 'DELETE_STOCK_CORRECTION',
      description: 'Delete a stock correction',
    },
  },
  SELL: {
    VIEW_DASHBOARD: {
      name: 'VIEW_SELL_DASHBOARD',
      description: 'View comprehensive sell dashboard data',
    },
    CREATE: { name: 'CREATE_SELL', description: 'Create a new sell record' },
    VIEW: { name: 'VIEW_SELL', description: 'View details of a specific sell' },
    VIEW_ALL: { name: 'VIEW_ALL_SELLS', description: 'View all sell records' },
    UPDATE: {
      name: 'UPDATE_SELL',
      description: 'Update details of a sell record',
    },
    DELETE: { name: 'DELETE_SELL', description: 'Delete a sell record' },

    DELIVER_ALL: {
      name: 'DELIVER_ALL_SALE_ITEMS',
      description: 'Mark all sale items as delivered',
    },
    COMPLETE_DELIVERY: {
      name: 'COMPLETE_SALE_DELIVERY',
      description: 'Complete the delivery of a sale',
    },
    PARTIAL_DELIVERY: {
      name: 'PARTIAL_SALE_DELIVERY',
      description: 'Mark partial sale delivery',
    },

    UPDATE_STATUS: {
      name: 'UPDATE_SELL_STATUS',
      description: 'Update status of a sale',
    },
    UPDATE_PAYMENT_STATUS: {
      name: 'UPDATE_PAYMENT_STATUS',
      description: 'Update payment status of a sale',
    },
    CANCEL: {
      name: 'CANCEL_SELL',
      description: 'Cancel a sell record',
    },
  },
  INVENTORY_DASHBOARD: {
    VIEW_DASHBOARD: {
      name: 'VIEW_INVENTORY_DASHBOARD',
      description: 'View comprehensive inventory dashboard data',
    },
  },
  PURCHASE: {
    CREATE: {
      name: 'CREATE_PURCHASE',
      description: 'Create a new purchase record',
    },
    VIEW_ALL: {
      name: 'VIEW_ALL_PURCHASES',
      description: 'View all purchase records',
    },
    UPDATE: {
      name: 'UPDATE_PURCHASE',
      description: 'Update details of a purchase record',
    },
    ACCEPT: {
      name: 'ACCEPT_PURCHASE',
      description: 'Accept and approve a purchase record',
    },
    DELETE: {
      name: 'DELETE_PURCHASE',
      description: 'Delete a purchase record',
    },
  },
  REPORT: {
    VIEW_TOTAL_SOLD: {
      name: 'VIEW_TOTAL_SOLD',
      description: 'View total sold products report',
    },
    VIEW_ALL_TRENDS: {
      name: 'VIEW_ALL_SELLS_TREND',
      description: 'View sales trends across all sells',
    },
    VIEW_SALES_RANK: {
      name: 'VIEW_SALES_RANK',
      description: 'View ranked sales report',
    },
    VIEW_REPORT: {
      name: 'VIEW_SALES_REPORT_VIEW_DASHBOARD',
      description: 'View sales report',
    },
    RESET: {
      name: 'RESET_VIEW_DASHBOARD',
      description: 'Reset page',
    },
    MAIN_DASHBOARD: {
      name: 'VIEW_MAIN_DASHBOARD',
      description: 'View main dashboard',
    },
  },

  MANAGE_STORE_AND_SHOPS: {
    VIEW_AND_MANAGE_STORE_AND_SHOPS: {
      name: 'VIEW_AND_MANAGE_STORE_AND_SHOPS',
      description: 'View and manage stores and shops',
    },
  },
};
