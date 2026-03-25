import Purchases, { PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// REVENUECAT CONFIG - REPLACE WITH YOUR OWN!
// ============================================================================

const REVENUECAT_API_KEY_IOS = 'appl_XXXXXXXXXXXXXXXXXXXXXXX'; // Replace
const REVENUECAT_API_KEY_ANDROID = 'goog_XXXXXXXXXXXXXXXXXXXXXXX'; // Replace

const ENTITLEMENT_ID = 'premium'; // The entitlement ID in RevenueCat
const PRODUCT_ID = 'colormind_adfree'; // Product ID in App Store / Play Store

// ============================================================================
// INITIALIZE PURCHASES
// ============================================================================

export const initializePurchases = async () => {
  try {
    const apiKey = Platform.OS === 'ios' 
      ? REVENUECAT_API_KEY_IOS 
      : REVENUECAT_API_KEY_ANDROID;
    
    await Purchases.configure({ apiKey });
    console.log('RevenueCat initialized');
  } catch (error) {
    console.error('Failed to initialize RevenueCat:', error);
  }
};

// ============================================================================
// CHECK IF USER HAS PREMIUM (AD-FREE)
// ============================================================================

export const checkPremiumStatus = async (): Promise<boolean> => {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch (error) {
    console.error('Failed to check premium status:', error);
    // Fallback to local storage
    const stored = await AsyncStorage.getItem('isPremium');
    return stored === 'true';
  }
};

// ============================================================================
// GET AVAILABLE PACKAGES
// ============================================================================

export const getOfferings = async (): Promise<PurchasesPackage | null> => {
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current?.availablePackages.length) {
      return offerings.current.availablePackages[0];
    }
    return null;
  } catch (error) {
    console.error('Failed to get offerings:', error);
    return null;
  }
};

// ============================================================================
// PURCHASE AD-FREE VERSION
// ============================================================================

export const purchaseAdFree = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const offerings = await Purchases.getOfferings();
    
    if (!offerings.current?.availablePackages.length) {
      return { success: false, error: 'Keine Pakete verfügbar' };
    }

    const packageToBuy = offerings.current.availablePackages[0];
    const { customerInfo } = await Purchases.purchasePackage(packageToBuy);
    
    if (customerInfo.entitlements.active[ENTITLEMENT_ID]) {
      // Purchase successful
      await AsyncStorage.setItem('isPremium', 'true');
      return { success: true };
    }
    
    return { success: false, error: 'Kauf nicht abgeschlossen' };
  } catch (error: any) {
    if (error.userCancelled) {
      return { success: false, error: 'Abgebrochen' };
    }
    return { success: false, error: error.message || 'Unbekannter Fehler' };
  }
};

// ============================================================================
// RESTORE PURCHASES
// ============================================================================

export const restorePurchases = async (): Promise<boolean> => {
  try {
    const customerInfo = await Purchases.restorePurchases();
    const isPremium = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
    
    if (isPremium) {
      await AsyncStorage.setItem('isPremium', 'true');
    }
    
    return isPremium;
  } catch (error) {
    console.error('Failed to restore purchases:', error);
    return false;
  }
};

// ============================================================================
// FORMAT PRICE
// ============================================================================

export const getFormattedPrice = async (): Promise<string> => {
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current?.availablePackages.length) {
      return offerings.current.availablePackages[0].product.priceString;
    }
    return '2,99 €';
  } catch {
    return '2,99 €';
  }
};
