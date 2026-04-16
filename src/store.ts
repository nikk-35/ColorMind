import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initConnection,
  endConnection,
  getProducts,
  requestPurchase,
  getAvailablePurchases,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  type ProductPurchase,
  type PurchaseError,
} from 'react-native-iap';

const PRODUCT_ID = 'com.weblity.colormind.premium';
const PREMIUM_KEY = '@colormind_premium';

let isConnected = false;
let purchaseUpdateSubscription: any = null;
let purchaseErrorSubscription: any = null;

// Callback for when premium is purchased
let onPremiumPurchased: (() => void) | null = null;

export const setOnPremiumPurchased = (callback: () => void) => {
  onPremiumPurchased = callback;
};

export const initStore = async (): Promise<boolean> => {
  if (Platform.OS === 'web') return false;
  if (isConnected) return true;
  
  try {
    await initConnection();
    isConnected = true;
    
    // Listen for purchases
    purchaseUpdateSubscription = purchaseUpdatedListener(async (purchase: ProductPurchase) => {
      if (purchase.productId === PRODUCT_ID) {
        await finishTransaction({ purchase, isConsumable: false });
        await savePremiumStatus(true);
        if (onPremiumPurchased) onPremiumPurchased();
      }
    });
    
    purchaseErrorSubscription = purchaseErrorListener((error: PurchaseError) => {
      console.log('Purchase error:', error);
    });
    
    return true;
  } catch (error) {
    console.error('Store init error:', error);
    return false;
  }
};

export const disconnectStore = async () => {
  if (purchaseUpdateSubscription) {
    purchaseUpdateSubscription.remove();
    purchaseUpdateSubscription = null;
  }
  if (purchaseErrorSubscription) {
    purchaseErrorSubscription.remove();
    purchaseErrorSubscription = null;
  }
  if (isConnected) {
    await endConnection();
    isConnected = false;
  }
};

export const checkPremium = async (): Promise<boolean> => {
  try {
    // Check local storage first
    const stored = await AsyncStorage.getItem(PREMIUM_KEY);
    if (stored === 'true') return true;
    
    // Check purchase history
    if (!isConnected) await initStore();
    
    const purchases = await getAvailablePurchases();
    const hasPremium = purchases.some(p => p.productId === PRODUCT_ID);
    
    if (hasPremium) {
      await savePremiumStatus(true);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Check premium error:', error);
    return false;
  }
};

export const purchasePremium = async (): Promise<boolean> => {
  try {
    if (!isConnected) await initStore();
    
    // Get products first
    const products = await getProducts({ skus: [PRODUCT_ID] });
    
    if (!products || products.length === 0) {
      console.log('Product not found:', PRODUCT_ID);
      return false;
    }
    
    // Request purchase
    await requestPurchase({ sku: PRODUCT_ID });
    
    // Result comes through listener
    return true;
  } catch (error: any) {
    if (error.code !== 'E_USER_CANCELLED') {
      console.error('Purchase error:', error);
    }
    return false;
  }
};

export const restorePurchases = async (): Promise<boolean> => {
  try {
    if (!isConnected) await initStore();
    
    const purchases = await getAvailablePurchases();
    const hasPremium = purchases.some(p => p.productId === PRODUCT_ID);
    
    if (hasPremium) {
      await savePremiumStatus(true);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Restore error:', error);
    return false;
  }
};

const savePremiumStatus = async (isPremium: boolean) => {
  await AsyncStorage.setItem(PREMIUM_KEY, isPremium ? 'true' : 'false');
};

export const getProductPrice = async (): Promise<string> => {
  try {
    if (!isConnected) await initStore();
    
    const products = await getProducts({ skus: [PRODUCT_ID] });
    
    if (products && products.length > 0) {
      return products[0].localizedPrice || '€2,99';
    }
    
    return '€2,99';
  } catch {
    return '€2,99';
  }
};
