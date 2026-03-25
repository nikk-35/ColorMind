import {
  InterstitialAd,
  RewardedAd,
  BannerAd,
  BannerAdSize,
  TestIds,
  AdEventType,
  RewardedAdEventType,
} from 'react-native-google-mobile-ads';

// ============================================================================
// AD UNIT IDs - REPLACE WITH YOUR OWN FROM ADMOB!
// ============================================================================

// Use test IDs during development, real IDs in production
const IS_TESTING = __DEV__;

export const AD_UNITS = {
  BANNER: IS_TESTING ? TestIds.BANNER : 'ca-app-pub-XXXXX/XXXXX', // Replace
  INTERSTITIAL: IS_TESTING ? TestIds.INTERSTITIAL : 'ca-app-pub-XXXXX/XXXXX', // Replace
  REWARDED: IS_TESTING ? TestIds.REWARDED : 'ca-app-pub-XXXXX/XXXXX', // Replace
};

// ============================================================================
// INTERSTITIAL AD (Show between games)
// ============================================================================

let interstitialAd: InterstitialAd | null = null;
let interstitialLoaded = false;

export const loadInterstitial = () => {
  interstitialAd = InterstitialAd.createForAdRequest(AD_UNITS.INTERSTITIAL, {
    requestNonPersonalizedAdsOnly: true,
  });

  interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
    interstitialLoaded = true;
    console.log('Interstitial ad loaded');
  });

  interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
    interstitialLoaded = false;
    loadInterstitial(); // Preload next ad
  });

  interstitialAd.load();
};

export const showInterstitial = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (interstitialLoaded && interstitialAd) {
      interstitialAd.show();
      resolve(true);
    } else {
      resolve(false);
    }
  });
};

// ============================================================================
// REWARDED AD (Watch for bonus)
// ============================================================================

let rewardedAd: RewardedAd | null = null;
let rewardedLoaded = false;

export const loadRewarded = () => {
  rewardedAd = RewardedAd.createForAdRequest(AD_UNITS.REWARDED, {
    requestNonPersonalizedAdsOnly: true,
  });

  rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
    rewardedLoaded = true;
    console.log('Rewarded ad loaded');
  });

  rewardedAd.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward) => {
    console.log('User earned reward:', reward);
  });

  rewardedAd.addAdEventListener(AdEventType.CLOSED, () => {
    rewardedLoaded = false;
    loadRewarded(); // Preload next ad
  });

  rewardedAd.load();
};

export const showRewarded = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (rewardedLoaded && rewardedAd) {
      rewardedAd.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        resolve(true);
      });
      rewardedAd.addAdEventListener(AdEventType.CLOSED, () => {
        resolve(false);
      });
      rewardedAd.show();
    } else {
      resolve(false);
    }
  });
};

// ============================================================================
// INITIALIZE ADS
// ============================================================================

export const initializeAds = () => {
  loadInterstitial();
  loadRewarded();
};

// Export BannerAd component for use in JSX
export { BannerAd, BannerAdSize };
