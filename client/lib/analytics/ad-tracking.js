/**
 * External dependencies
 */
import async from 'async';
import noop from 'lodash/noop';
import some from 'lodash/some';
import clone from 'lodash/clone';
import debugFactory from 'debug';
const debug = debugFactory( 'calypso:ad-tracking' );

/**
 * Internal dependencies
 */
import loadScript from 'lib/load-script';
import config from 'config';

/**
 * Module variables
 */
let hasStartedFetchingScripts = false,
	retargetingInitialized = false;

/**
 * Constants
 */
const FACEBOOK_TRACKING_SCRIPT_URL = 'https://connect.facebook.net/en_US/fbevents.js',
	ATLAS_TRACKING_SCRIPT_URL = 'https://ad.atdmt.com/m/a.js',
	GOOGLE_TRACKING_SCRIPT_URL = 'https://www.googleadservices.com/pagead/conversion_async.js',
	BING_TRACKING_SCRIPT_URL = 'https://bat.bing.com/bat.js',
	GOOGLE_CONVERSION_ID = config( 'google_adwords_conversion_id' ),
	TRACKING_IDS = {
		bingInit: '4074038',
		facebookInit: '823166884443641',
		googleConversionLabel: 'MznpCMGHr2MQ1uXz_AM',
		atlasUniveralTagId: '11187200770563'
	};

/**
 * Globals
 */
if ( ! window.fbq ) {
	setUpFacebookGlobal();
}

if ( ! window.uetq ) {
	window.uetq = []; // Bing global
}

/**
 * This sets up the globals that the Facebook event library expects.
 * More info here: https://www.facebook.com/business/help/952192354843755
 */
function setUpFacebookGlobal() {
	const facebookEvents = window.fbq = function() {
		if ( facebookEvents.callMethod ) {
			facebookEvents.callMethod.apply( facebookEvents, arguments );
		} else {
			facebookEvents.queue.push( arguments );
		}
	};

	if ( ! window._fbq ) {
		window._fbq = facebookEvents;
	}

	facebookEvents.push = facebookEvents;
	facebookEvents.loaded = true;
	facebookEvents.version = '2.0';
	facebookEvents.queue = [];
}

function loadTrackingScripts( callback ) {
	hasStartedFetchingScripts = true;

	async.parallel( [
		function( onComplete ) {
			loadScript.loadScript( FACEBOOK_TRACKING_SCRIPT_URL, onComplete );
		},
		function( onComplete ) {
			loadScript.loadScript( GOOGLE_TRACKING_SCRIPT_URL, onComplete );
		},
		function( onComplete ) {
			loadScript.loadScript( BING_TRACKING_SCRIPT_URL, onComplete );
		}
	], function( errors ) {
		if ( ! some( errors ) ) {
			// update Facebook's tracking global
			window.fbq( 'init', TRACKING_IDS.facebookInit );

			// update Bing's tracking global
			const bingConfig = {
				ti: TRACKING_IDS.bingInit,
				q: window.uetq
			};

			if ( typeof UET !== 'undefined' ) {
				// bing's script creates the UET global for us
				window.uetq = new UET( bingConfig ); // eslint-disable-line
				window.uetq.push( 'pageLoad' );
			}

			if ( typeof callback === 'function' ) {
				callback();
			}
		} else {
			debug( 'Some scripts failed to load: ', errors );
		}
	} );
}

function retarget() {
	if ( ! hasStartedFetchingScripts ) {
		return loadTrackingScripts( retarget );
	}

	if ( ! retargetingInitialized ) {
		debug( 'Retargeting initialized' );

		window.fbq( 'track', 'PageView' );
		retargetingInitialized = true;
	}
}

function recordAddToCart( cartItem ) {
	if ( ! config.isEnabled( 'ad-tracking' ) ) {
		return;
	}

	if ( ! hasStartedFetchingScripts ) {
		return loadTrackingScripts( recordAddToCart.bind( null, cartItem ) );
	}

	debug( 'Recorded that this item was added to the cart', cartItem );

	window.fbq(
		'track',
		'AddToCart',
		{
			product_slug: cartItem.product_slug,
			free_trial: Boolean( cartItem.free_trial )
		}
	);
}

function recordPurchase( product ) {
	if ( ! config.isEnabled( 'ad-tracking' ) ) {
		return;
	}

	if ( ! hasStartedFetchingScripts ) {
		return loadTrackingScripts( recordPurchase.bind( null, product ) );
	}

	debug( 'Recording purchase', product );

	// record the purchase w/ Atlas
	recordPurchaseInAtlas( product );

	// record the purchase w/ Facebook
	window.fbq(
		'track',
		'Purchase',
		{
			currency: product.currency,
			product_slug: product.product_slug,
			value: product.cost
		}
	);

	// record the purchase w/ Bing if it is made with USD - Bing doesn't handle multiple currencies
	if ( 'USD' === product.currency ) {
		window.uetq.push( {
			ec: 'purchase',
			gv: product.cost
		} );
	}

	// record the purchase w/ Google
	window.google_trackConversion( {
		google_conversion_id: GOOGLE_CONVERSION_ID,
		google_conversion_label: TRACKING_IDS.googleConversionLabel,
		google_conversion_value: product.cost,
		google_conversion_currency: product.currency,
		google_custom_params: {
			product_slug: product.product_slug
		},
		google_remarketing_only: false
	} );
}

/**
 * Tracking conversions in Atlas requires we load the Atlas script
 * with the event name and properties included as URL parameters
 *
 * @see https://app.atlassolutions.com/help/atlashelp/727514814019823/ (Atlas account required)
 *
 * @param {Object} product - The product that was just purchased
 */
function recordPurchaseInAtlas( product ) {
	let params, urlParams, urlWithParams;

	params = clone( product );

	// `revenue` and `currency_code` are properties Atlas expects
	// See: https://app.atlassolutions.com/help/atlashelp/1467977866814592
	params.revenue = product.cost;
	params.currency_code = product.currency;

	// We also manually set an `event` property with the event name that we'll reference in Atlas
	// See: https://app.atlassolutions.com/help/atlashelp/989871004366077
	params.event = 'Purchase';

	urlParams = Object.keys( params ).map( function( key ) {
		return encodeURIComponent( key ) + '=' + encodeURIComponent( params[ key ] );
	} ).join( '&' );

	// Note that the semicolon before the `m` and `cache` params as well
	// as the cache buster are expected by Atlas
	urlWithParams = ATLAS_TRACKING_SCRIPT_URL + ';m=' + TRACKING_IDS.atlasUniveralTagId +
		';cache=' + Math.random() + '?' + urlParams;

	loadScript.loadScript( urlWithParams );
}

module.exports = {
	retarget: function( context, next ) {
		const nextFunction = typeof next === 'function' ? next : noop;

		if ( config.isEnabled( 'ad-tracking' ) ) {
			retarget();
		}

		nextFunction();
	},

	recordAddToCart,
	recordPurchase
};
