import Purchases, { PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import { Platform } from 'react-native';

const API_KEY = 'test_MXeCMGvHhKtXPnhKNmDCLnvxPBi';
const ENTITLEMENT_ID = 'premium';

let isInitialized = false;

export const initializePurchases = async (userId?: string): Promise<boolean> => {
  if (isInitialized) return true;
  
  try {
    if (Platform.OS === 'web') return false;
    
    Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
    
    if (userId) {
      await Purchases.configure({ apiKey: API_KEY, appUserID: userId });
    } else {
      await Purchases.configure({ apiKey: API_KEY });
    }
    
    isInitialized = true;
    console.log('RevenueCat initialized');
    return true;
  } catch (error) {
    console.error('RevenueCat init error:', error);
    return false;
  }
};

export const checkPremiumStatus = async (): Promise<boolean> => {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch (error) {
    console.error('Check premium error:', error);
    return false;
  }
};

export const getOfferings = async (): Promise<PurchasesPackage | null> => {
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current && offerings.current.availablePackages.length > 0) {
      // Return lifetime package
      return offerings.current.lifetime || offerings.current.availablePackages[0];
    }
    return null;
  } catch (error) {
    console.error('Get offerings error:', error);
    return null;
  }
};

export const purchasePremium = async (): Promise<boolean> => {
  try {
    const pkg = await getOfferings();
    if (!pkg) {
      console.log('No package available');
      return false;
    }
    
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch (error: any) {
    if (!error.userCancelled) {
      console.error('Purchase error:', error);
    }
    return false;
  }
};

export const restorePurchases = async (): Promise<boolean> => {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch (error) {
    console.error('Restore error:', error);
    return false;
  }
};
