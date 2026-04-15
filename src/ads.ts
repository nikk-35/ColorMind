import { Platform } from 'react-native';
import mobileAds, { 
  BannerAd, 
  BannerAdSize, 
  InterstitialAd, 
  AdEventType,
  TestIds 
} from 'react-native-google-mobile-ads';

// Use test IDs in development, real IDs in production
const IS_DEV = __DEV__;

export const AD_IDS = {
  banner: IS_DEV ? TestIds.BANNER : 'ca-app-pub-9254337095601557/8035819607',
  interstitial: IS_DEV ? TestIds.INTERSTITIAL : 'ca-app-pub-9254337095601557/2775754061',
};

// Initialize ads
let adsInitialized = false;

export const initializeAds = async (): Promise<boolean> => {
  if (adsInitialized) return true;
  
  try {
    await mobileAds().initialize();
    adsInitialized = true;
    console.log('Ads initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize ads:', error);
    return false;
  }
};

// Interstitial ad instance
let interstitial: InterstitialAd | null = null;
let interstitialLoaded = false;

export const loadInterstitial = () => {
  try {
    interstitial = InterstitialAd.createForAdRequest(AD_IDS.interstitial, {
      requestNonPersonalizedAdsOnly: true,
    });

    interstitial.addAdEventListener(AdEventType.LOADED, () => {
      interstitialLoaded = true;
    });

    interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      interstitialLoaded = false;
      // Reload for next time
      loadInterstitial();
    });

    interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
      console.log('Interstitial error:', error);
      interstitialLoaded = false;
    });

    interstitial.load();
  } catch (error) {
    console.error('Failed to load interstitial:', error);
  }
};

export const showInterstitial = async (): Promise<boolean> => {
  if (!interstitialLoaded || !interstitial) {
    loadInterstitial();
    return false;
  }

  try {
    await interstitial.show();
    return true;
  } catch (error) {
    console.error('Failed to show interstitial:', error);
    return false;
  }
};

export { BannerAd, BannerAdSize };
