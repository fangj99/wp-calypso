/**
 * External dependencies
 */
import { combineReducers } from 'redux';

/**
 * Internal dependencies
 */
import {
	CURRENT_USER_ID_SET,
	CURRENT_USER_FLAGS_RECEIVE,
	SITE_RECEIVE,
	SITES_RECEIVE
} from 'state/action-types';
import { createReducer } from 'state/utils';
import { idSchema, capabilitiesSchema, flagsSchema, } from './schema';

/**
 * Tracks the current user ID.
 *
 * @param  {Object} state  Current state
 * @param  {Object} action Action payload
 * @return {Object}        Updated state
 */
export const id = createReducer( null, {
	[ CURRENT_USER_ID_SET ]: ( state, action ) => action.userId
}, idSchema );

export const flags = createReducer( [], {
	[ CURRENT_USER_FLAGS_RECEIVE ]: ( state, action ) => action.flags
}, flagsSchema );

/**
 * Returns the updated capabilities state after an action has been dispatched.
 * The state maps site ID keys to an object of current user capabilities for
 * that site.
 *
 * @param  {Object} state  Current state
 * @param  {Object} action Action payload
 * @return {Object}        Updated state
 */
export const capabilities = createReducer( {}, {
	[ SITE_RECEIVE ]: ( state, action ) => {
		if ( ! action.site.capabilities ) {
			return state;
		}

		return Object.assign( {}, state, {
			[ action.site.ID ]: action.site.capabilities
		} );
	},
	[ SITES_RECEIVE ]: ( state, action ) => {
		const siteCapabilities = action.sites.reduce( ( memo, site ) => {
			if ( site.capabilities ) {
				memo[ site.ID ] = site.capabilities;
			}

			return memo;
		}, {} );

		return Object.assign( {}, state, siteCapabilities );
	}
}, capabilitiesSchema );

export default combineReducers( {
	id,
	capabilities,
	flags
} );
