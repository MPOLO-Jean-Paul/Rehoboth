import { Dimensions, Platform, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Guideline sizes are based on standard ~5" screen mobile device (iPhone 11/12/13/14)
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

/**
 * Linear scaling for width, horizontal padding, margin, etc.
 */
const scale = (size) => (SCREEN_WIDTH / guidelineBaseWidth) * size;

/**
 * Linear scaling for height, vertical padding, margin, line height, etc.
 */
const verticalScale = (size) => (SCREEN_HEIGHT / guidelineBaseHeight) * size;

/**
 * Moderate scaling for font size, border radius, etc. 
 * Allows for scaling but with a 'factor' to prevent extreme changes on large screens.
 */
const moderateScale = (size, factor = 0.5) => size + (scale(size) - size) * factor;

/**
 * Specialized font scaling that respects user system settings (if needed)
 */
const fontScale = (size) => {
    const scaleFactor = PixelRatio.getFontScale();
    return moderateScale(size) * scaleFactor;
};

export {
    SCREEN_WIDTH,
    SCREEN_HEIGHT,
    scale,
    verticalScale,
    moderateScale,
    fontScale
};
