import * as InAppPurchases from 'expo-in-app-purchases';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PRODUCT_ID = 'com.weblity.colormind.adfree';
const PREMIUM_KEY = '@colormind_premium';

let isConnected = false;

export const initStore = async (): Promise<boolean> => {
  if (Platform.OS === 'web') return false;
  if (isConnected) return true;
  
  try {
    await InAppPurchases.connectAsync();
    isConnected = true;
    
    // Set up purchase listener
    InAppPurchases.setPurchaseListener(({ responseCode, results }) => {
      if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
        for (const purchase of results) {
          if (!purchase.acknowledged) {
            // Finish the transaction
            InAppPurchases.finishTransactionAsync(purchase, true);
            // Save premium status
            savePremiumStatus(true);
          }
        }
      }
    });
    
    return true;
  } catch (error) {
    console.error('Store init error:', error);
    return false;
  }
};

export const disconnectStore = async () => {
  if (isConnected) {
    await InAppPurchases.disconnectAsync();
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
    const { results } = await InAppPurchases.getPurchaseHistoryAsync();
    
    if (results && results.length > 0) {
      const hasPremium = results.some(p => p.productId === PRODUCT_ID);
      if (hasPremium) {
        await savePremiumStatus(true);
        return true;
      }
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
    
    // Get product
    const { results } = await InAppPurchases.getProductsAsync([PRODUCT_ID]);
    
    if (!results || results.length === 0) {
      console.log('Product not found');
      return false;
    }
    
    // Purchase
    await InAppPurchases.purchaseItemAsync(PRODUCT_ID);
    
    // The result comes through the purchase listener
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
    
    const { results } = await InAppPurchases.getPurchaseHistoryAsync();
    
    if (results && results.length > 0) {
      const hasPremium = results.some(p => p.productId === PRODUCT_ID);
      if (hasPremium) {
        await savePremiumStatus(true);
        return true;
      }
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
    
    const { results } = await InAppPurchases.getProductsAsync([PRODUCT_ID]);
    
    if (results && results.length > 0) {
      return results[0].price;
    }
    
    return '€2,99';
  } catch {
    return '€2,99';
  }
};
