import { Language } from '../types';

export interface Translations {
  appName: string;
  wordmarkPart1: string;
  wordmarkPart2: string;
  nav: {
    dashboard: string;
    pos: string;
    stock: string;
    transfers: string;
    purchases: string;
    services: string;
    customers: string;
    appointments: string;
    promotions: string;
    whatsapp: string;
    reports: string;
    import: string;
    settings: string;
  };
  branches: {
    all: string;
    main: string;
    hargeisaNorth: string;
    burao: string;
  };
  roles: {
    owner: string;
    branchManager: string;
    receptionist: string;
    dentist: string;
    storekeeper: string;
  };
  dashboard: {
    title: string;
    subtitle: string;
    todaySales: string;
    todayAppointments: string;
    lowStockItems: string;
    expiringBatches: string;
    wholesaleDebt: string;
    sales14Days: string;
    needsAttention: string;
    branchComparison: string;
    viewAll: string;
    reorderNow: string;
    confirmAppointment: string;
    collectDebt: string;
    transferStock: string;
  };
  pos: {
    title: string;
    searchPlaceholder: string;
    itemsTab: string;
    servicesTab: string;
    cartTitle: string;
    customerSelect: string;
    walkInCustomer: string;
    retailPriceList: string;
    wholesalePriceList: string;
    automaticPromo: string;
    loyaltyPointsToggle: string;
    pointsAvailable: string;
    subtotal: string;
    discount: string;
    vat: string;
    total: string;
    paymentMethod: string;
    cash: string;
    mobileMoney: string;
    bank: string;
    credit: string;
    printReceipt: string;
    downloadInvoice: string;
    sendWhatsApp: string;
    checkoutNow: string;
    emptyCartMessage: string;
  };
  stock: {
    title: string;
    searchPlaceholder: string;
    filterAll: string;
    filterLowStock: string;
    filterNearExpiry: string;
    filterOutOfStock: string;
    adjustStock: string;
    sku: string;
    name: string;
    category: string;
    branchQty: string;
    reorderLevel: string;
    status: string;
    nearestExpiry: string;
    batches: string;
    movementHistory: string;
    batchNumber: string;
    unitCost: string;
  };
  common: {
    actions: string;
    status: string;
    cancel: string;
    save: string;
    confirm: string;
    back: string;
    export: string;
    filter: string;
    search: string;
    refresh: string;
    inStock: string;
    lowStock: string;
    outOfStock: string;
    nearExpiry: string;
    expired: string;
    viewDetails: string;
    currency: string;
  };
}

export const translations: Record<Language, Translations> = {
  en: {
    appName: 'DentaFlow',
    wordmarkPart1: 'Denta',
    wordmarkPart2: 'Flow',
    nav: {
      dashboard: 'Dashboard',
      pos: 'Point of Sale',
      stock: 'Stock',
      transfers: 'Transfers',
      purchases: 'Purchases',
      services: 'Services',
      customers: 'Customers',
      appointments: 'Appointments',
      promotions: 'Promotions',
      whatsapp: 'WhatsApp',
      reports: 'Reports',
      import: 'Import',
      settings: 'Settings',
    },
    branches: {
      all: 'All branches',
      main: 'Main Clinic (Central)',
      hargeisaNorth: 'Hargeisa North',
      burao: 'Burao Branch',
    },
    roles: {
      owner: 'Owner',
      branchManager: 'Branch Manager',
      receptionist: 'Receptionist',
      dentist: 'Dentist',
      storekeeper: 'Storekeeper',
    },
    dashboard: {
      title: 'Practice & Inventory Overview',
      subtitle: 'Real-time performance metrics and multi-branch inventory health',
      todaySales: "Today's Sales",
      todayAppointments: 'Appointments',
      lowStockItems: 'Low-Stock Items',
      expiringBatches: 'Expiring Soon (30d)',
      wholesaleDebt: 'Wholesale Debt',
      sales14Days: 'Sales Performance (Last 14 Days)',
      needsAttention: 'Needs Attention',
      branchComparison: 'Multi-Branch Revenue & Stock Comparison',
      viewAll: 'View all',
      reorderNow: 'Reorder',
      confirmAppointment: 'Confirm',
      collectDebt: 'Remind',
      transferStock: 'Transfer',
    },
    pos: {
      title: 'Clinical Point of Sale',
      searchPlaceholder: 'Scan barcode or search items and services...',
      itemsTab: 'Dental Items',
      servicesTab: 'Clinical Services',
      cartTitle: 'Current Transaction',
      customerSelect: 'Select Customer',
      walkInCustomer: 'Walk-in Retail Patient',
      retailPriceList: 'Retail Price List',
      wholesalePriceList: 'Wholesale Tier A',
      automaticPromo: 'Automatic promotion applied',
      loyaltyPointsToggle: 'Redeem Loyalty Points',
      pointsAvailable: 'pts available',
      subtotal: 'Subtotal',
      discount: 'Discounts & Offers',
      vat: 'VAT (5.0%)',
      total: 'Total Due',
      paymentMethod: 'Payment Method',
      cash: 'Cash',
      mobileMoney: 'Mobile Money (Zaad / Telesom)',
      bank: 'Bank Transfer (Dahabshiil)',
      credit: 'Credit / Account',
      printReceipt: 'Print Thermal Receipt',
      downloadInvoice: 'Download A4 Invoice',
      sendWhatsApp: 'Send on WhatsApp',
      checkoutNow: 'Complete Checkout',
      emptyCartMessage: 'Cart is empty. Select items or services on the left to begin.',
    },
    stock: {
      title: 'Inventory & Batch Management',
      searchPlaceholder: 'Search by item name, SKU, or batch number...',
      filterAll: 'All Items',
      filterLowStock: 'Low Stock',
      filterNearExpiry: 'Near Expiry',
      filterOutOfStock: 'Out of Stock',
      adjustStock: 'Adjust Stock',
      sku: 'SKU',
      name: 'Item Name',
      category: 'Category',
      branchQty: 'Branch Stock',
      reorderLevel: 'Reorder Level',
      status: 'Stock Status',
      nearestExpiry: 'Nearest Expiry',
      batches: 'Active Batches',
      movementHistory: 'Movement History',
      batchNumber: 'Batch #',
      unitCost: 'Cost / Unit',
    },
    common: {
      actions: 'Actions',
      status: 'Status',
      cancel: 'Cancel',
      save: 'Save Changes',
      confirm: 'Confirm',
      back: 'Back',
      export: 'Export CSV',
      filter: 'Filter',
      search: 'Search',
      refresh: 'Refresh',
      inStock: 'In stock',
      lowStock: 'Low stock',
      outOfStock: 'Out of stock',
      nearExpiry: 'Near expiry',
      expired: 'Expired',
      viewDetails: 'View Details',
      currency: 'USD',
    },
  },
  so: {
    appName: 'DentaFlow',
    wordmarkPart1: 'Denta',
    wordmarkPart2: 'Flow',
    nav: {
      dashboard: 'Dulmar Guud',
      pos: 'Goobta Iibka (POS)',
      stock: 'Bakhaarka & Alaabta',
      transfers: 'Wareejinta Laamaha',
      purchases: 'Iibsashada Cusub',
      services: 'Adeegyada Caafimaadka',
      customers: 'Macaamiisha',
      appointments: 'Ballamaha Bukaanada',
      promotions: 'Xayeysiiska & Qiimo-Dhimista',
      whatsapp: 'Farriimaha WhatsApp',
      reports: 'Warbixinnada',
      import: 'Soo Dejinta Xogta',
      settings: 'Dejinta Nidaamka',
    },
    branches: {
      all: 'Dhammaan Laamaha',
      main: 'Rugta Guud (Hargeysa Dhexe)',
      hargeisaNorth: 'Hargeysa Waqooyi',
      burao: 'Laanta Burco',
    },
    roles: {
      owner: 'Mulkiile',
      branchManager: 'Maamulaha Laanta',
      receptionist: 'Soo-dhaweyn',
      dentist: 'Dhakhtar Ilko',
      storekeeper: 'Khabiirka Bakhaarka',
    },
    dashboard: {
      title: 'Habsocodka Guud ee Rugta',
      subtitle: 'Xogta tooska ah ee dakhliga, ballamaha iyo kaydka qalabka',
      todaySales: 'Iibka Maanta',
      todayAppointments: 'Ballamaha Maanta',
      lowStockItems: 'Alaabta sii dhammaanaysa',
      expiringBatches: 'Waqtigoodu dhow yahay (30 cisho)',
      wholesaleDebt: 'Deynta Jumladlayaasha',
      sales14Days: 'Dhaqdhaqaaqa Iibka (14-kii Cisho ee u dambeeyay)',
      needsAttention: 'Waxyaabaha u Baahan Feejignaan',
      branchComparison: 'Iskubarbardhigga Dakhliga Laamaha',
      viewAll: 'Eeg dhammaan',
      reorderNow: 'Dalbo hadda',
      confirmAppointment: 'Xaqiiji',
      collectDebt: 'Xusuusi',
      transferStock: 'Wareeji',
    },
    pos: {
      title: 'Goobta Iibka & Adeegga',
      searchPlaceholder: 'Baar qalabka, adeegga ama lambarka baarkoodka...',
      itemsTab: 'Alaabta Ilkaha',
      servicesTab: 'Adeegyada Caafimaad',
      cartTitle: 'Dambiisha Iibka',
      customerSelect: 'Dooro Macmiilka',
      walkInCustomer: 'Bukaan Caadi ah (Tafaariiq)',
      retailPriceList: 'Qiimaha Tafaariiqda',
      wholesalePriceList: 'Qiimaha Jumlada (Heerka 1)',
      automaticPromo: 'Qiimo dhimis toos ah ayaa lagu daray',
      loyaltyPointsToggle: 'Isticmaal Dhibcaha Daacadnimada',
      pointsAvailable: 'dhibcood ayaa kuu diyaar ah',
      subtotal: 'Isu-geynta Hore',
      discount: 'Qiimo Dhimis',
      vat: 'Cashuurta VAT (5.0%)',
      total: 'Wadarta Guud',
      paymentMethod: 'Habka Lacag-bixinta',
      cash: 'Kaash (Lacag Cadaan ah)',
      mobileMoney: 'Lacagta Moobaylka (Zaad / Telesom)',
      bank: 'Xawaalad Bank (Dahabshiil)',
      credit: 'Deyn / Akoon',
      printReceipt: 'Daabac Rasiidka Yar',
      downloadInvoice: 'Soo Dejiso Qaansheegta A4',
      sendWhatsApp: 'Ku Dir WhatsApp',
      checkoutNow: 'Dhamaystir Iibka',
      emptyCartMessage: 'Dambiishu waa faaruq. Dooro alaab ama adeeg dhanka bidix.',
    },
    stock: {
      title: 'Maamulka Bakhaarka & Qaybaha',
      searchPlaceholder: 'Ku baar magaca alaabta, SKU, ama batch...',
      filterAll: 'Dhammaan Alaabta',
      filterLowStock: 'Sii Dhammaanaysa',
      filterNearExpiry: 'Dhicitaan Dhow',
      filterOutOfStock: 'Dhammaatay',
      adjustStock: 'Hagaaji Tirada',
      sku: 'SKU',
      name: 'Magaca Alaabta',
      category: 'Qaybta',
      branchQty: 'Kaydka Laanta',
      reorderLevel: 'Heerka Dalbashada',
      status: 'Xaaladda Kaydka',
      nearestExpiry: 'Taariikhda Dhicitaanka',
      batches: 'Qaybaha Firfircoon',
      movementHistory: 'Dhaqdhaqaaqa Hore',
      batchNumber: 'Lambarka Qaybta',
      unitCost: 'Qiimaha / Xabbo',
    },
    common: {
      actions: 'Ficilada',
      status: 'Xaaladda',
      cancel: 'Jooji',
      save: 'Keydi Isbeddelka',
      confirm: 'Xaqiiji',
      back: 'Dib u noqo',
      export: 'Soo Saaro CSV',
      filter: 'Shaandhee',
      search: 'Raadi',
      refresh: 'Cusbooneysii',
      inStock: 'Kayd buuxa',
      lowStock: 'Kayd yar',
      outOfStock: 'Waa go’day',
      nearExpiry: 'Waqti dhow',
      expired: 'Waa dhacday',
      viewDetails: 'Faahfaahin',
      currency: 'USD',
    },
  },
  ar: {
    appName: 'DentaFlow',
    wordmarkPart1: 'Denta',
    wordmarkPart2: 'Flow',
    nav: {
      dashboard: 'لوحة التحكم',
      pos: 'نقطة البيع',
      stock: 'المخزون والمستودع',
      transfers: 'التحويلات بين الفروع',
      purchases: 'أوامر الشراء',
      services: 'الخدمات العلاجية',
      customers: 'العملاء والمرضى',
      appointments: 'المواعيد والجدول',
      promotions: 'العروض الترويجية',
      whatsapp: 'رسائل واتساب',
      reports: 'التقارير المالية',
      import: 'استيراد البيانات',
      settings: 'الإعدادات العامة',
    },
    branches: {
      all: 'جميع الفروع',
      main: 'العيادة الرئيسية (الوسط)',
      hargeisaNorth: 'هرجيسا شمال',
      burao: 'فرع برعو',
    },
    roles: {
      owner: 'المالك',
      branchManager: 'مدير الفرع',
      receptionist: 'موظف الاستقبال',
      dentist: 'طبيب أسنان',
      storekeeper: 'أمين المستودع',
    },
    dashboard: {
      title: 'نظرة عامة على العيادة والمخزون',
      subtitle: 'مؤشرات الأداء المباشرة وصحة المخزون عبر جميع الفروع',
      todaySales: 'مبيعات اليوم',
      todayAppointments: 'مواعيد اليوم',
      lowStockItems: 'مواد قاربت على النفاد',
      expiringBatches: 'دفعات تنتهي قريباً (30 يوماً)',
      wholesaleDebt: 'مستحقات مبيعات الجملة',
      sales14Days: 'حركة المبيعات (آخر 14 يوماً)',
      needsAttention: 'مهام تتطلب المتابعة',
      branchComparison: 'مقارنة إيرادات ومخزون الفروع',
      viewAll: 'عرض الكل',
      reorderNow: 'طلب توريد',
      confirmAppointment: 'تأكيد الموعد',
      collectDebt: 'تذكير بالسداد',
      transferStock: 'تحويل بضاعة',
    },
    pos: {
      title: 'نقطة البيع السريرية',
      searchPlaceholder: 'امسح الباركود أو ابحث عن المنتجات والخدمات...',
      itemsTab: 'المستلزمات والأدوية',
      servicesTab: 'الإجراءات الطبية',
      cartTitle: 'سلة المعاملة الحالية',
      customerSelect: 'تحديد العميل / المريض',
      walkInCustomer: 'مريض نقدي مباشر (تجزئة)',
      retailPriceList: 'قائمة أسعار التجزئة',
      wholesalePriceList: 'أسعار الجملة (الفئة الأولى)',
      automaticPromo: 'تم تطبيق خصم ترويجي تلقائي',
      loyaltyPointsToggle: 'استبدال نقاط الولاء',
      pointsAvailable: 'نقطة متاحة',
      subtotal: 'المجموع الفرعي',
      discount: 'الخصومات والعروض',
      vat: 'ضريبة القيمة المضافة (5.0%)',
      total: 'الإجمالي المستحق',
      paymentMethod: 'طريقة الدفع',
      cash: 'نقداً',
      mobileMoney: 'الدفع الإلكتروني عبر الهاتف (زّاد / تليسوم)',
      bank: 'تحويل بنكي (دهب شيل)',
      credit: 'حساب آجل / ائتمان',
      printReceipt: 'طباعة الإيصال الحراري',
      downloadInvoice: 'تحميل فاتورة ضريبية A4',
      sendWhatsApp: 'إرسال عبر واتساب',
      checkoutNow: 'إتمام العملية والدفع',
      emptyCartMessage: 'السلة فارغة. يرجى اختيار المنتجات أو الخدمات من القائمة على اليسار.',
    },
    stock: {
      title: 'إدارة المخزون والدفعات',
      searchPlaceholder: 'بحث باسم المادة، الرمز SKU، أو رقم الدفعة...',
      filterAll: 'جميع المواد',
      filterLowStock: 'مخزون منخفض',
      filterNearExpiry: 'قارب على الانتهاء',
      filterOutOfStock: 'نفد من المخزون',
      adjustStock: 'تسوية الجرد',
      sku: 'الرمز (SKU)',
      name: 'اسم الصنف',
      category: 'التصنيف',
      branchQty: 'مخزون الفرع',
      reorderLevel: 'حد إعادة الطلب',
      status: 'حالة الصنف',
      nearestExpiry: 'أقرب تاريخ صلاحية',
      batches: 'الدفعات النشطة',
      movementHistory: 'سجل حركات المخزون',
      batchNumber: 'رقم الدفعة',
      unitCost: 'تكلفة الوحدة',
    },
    common: {
      actions: 'الإجراءات',
      status: 'الحالة',
      cancel: 'إلغاء',
      save: 'حفظ التعديلات',
      confirm: 'تأكيد',
      back: 'رجوع',
      export: 'تصدير CSV',
      filter: 'تصفية',
      search: 'بحث',
      refresh: 'تحديث',
      inStock: 'متوفر',
      lowStock: 'منخفض',
      outOfStock: 'غير متوفر',
      nearExpiry: 'قارب الانتهاء',
      expired: 'منتهي الصلاحية',
      viewDetails: 'عرض التفاصيل',
      currency: 'دولار',
    },
  },
};
