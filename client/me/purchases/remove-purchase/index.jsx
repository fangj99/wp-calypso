/**
 * External dependencies
 */
import page from 'page';
import React from 'react';
import shuffle from 'lodash/shuffle';

/**
 * Internal dependencies
 */
import config from 'config';
import CompactCard from 'components/card/compact';
import Dialog from 'components/dialog';
import { getIncludedDomain, getName, hasIncludedDomain, isRemovable } from 'lib/purchases';
import { getPurchase, isDataLoading } from '../utils';
import Gridicon from 'components/gridicon';
import { isDomainRegistration, isPlan, isGoogleApps } from 'lib/products-values';
import notices from 'notices';
import purchasePaths from '../paths';
import { removePurchase } from 'lib/upgrades/actions';
import FormSectionHeading from 'components/forms/form-section-heading';
import FormFieldset from 'components/forms/form-fieldset';
import FormLegend from 'components/forms/form-legend';
import FormLabel from 'components/forms/form-label';
import FormRadio from 'components/forms/form-radio';
import FormTextInput from 'components/forms/form-text-input';
import FormTextarea from 'components/forms/form-textarea';

/**
 * Module dependencies
 */
import debugFactory from 'debug';
const debug = debugFactory( 'calypso:purchases:survey' );

const RemovePurchase = React.createClass( {
	propTypes: {
		selectedPurchase: React.PropTypes.object.isRequired,
		selectedSite: React.PropTypes.oneOfType( [
			React.PropTypes.object,
			React.PropTypes.bool,
			React.PropTypes.undefined
		] ),
		user: React.PropTypes.object.isRequired
	},

	getInitialState() {
		// shuffle reason order, but keep another_reason_one last
		let questionOneOrder = shuffle( [
			'could_not_install',
			'too_hard',
			'did_not_include',
			'only_need_free'
		] );
		questionOneOrder.push( 'another_reason_one' );

		let questionTwoOrder = shuffle( [
			'staying_here',
			'other_wordpress',
			'different_service',
			'no_need'
		] );
		questionTwoOrder.push( 'another_reason_two' );

		return {
			isDialogVisible: false,
			isSurveyOneVisible: true,
			isSurveyTwoVisible: false,
			isRemoving: false,
			questionOneRadio: null,
			questionOneOrder: questionOneOrder,
			questionTwoRadio: null,
			questionTwoOrder: questionTwoOrder
		};
	},

	closeDialog() {
		this.setState( { isDialogVisible: false } );
	},

	openDialog( event ) {
		event.preventDefault();

		this.setState( { isDialogVisible: true } );
	},

	displaySurveyOne() {
		this.setState( {
			isSurveyOneVisible: true,
			isSurveyTwoVisible: false,
		} );
	},

	displaySurveyTwo() {
		this.setState( {
			isSurveyOneVisible: false,
			isSurveyTwoVisible: true,
		} );
	},

	removePurchase( closeDialog ) {
		this.setState( { isRemoving: true } );

		const purchase = getPurchase( this.props ),
			{ selectedSite, user } = this.props;

		// Tracks update goes here

		removePurchase( purchase.id, user.ID, success => {
			if ( success ) {
				const productName = getName( purchase );

				if ( isDomainRegistration( purchase ) ) {
					notices.success(
						this.translate( 'The domain {{domain/}} was removed from your account.', {
							components: { domain: <em>{ productName }</em> }
						} ),
						{ persistent: true }
					);
				} else {
					notices.success(
						this.translate( '%(productName)s was removed from {{siteName/}}.', {
							args: { productName },
							components: { siteName: <em>{ selectedSite.slug }</em> }
						} ),
						{ persistent: true }
					);
				}

				page( purchasePaths.list() );
			} else {
				this.setState( { isRemoving: false } );

				closeDialog();

				notices.error( this.props.selectedPurchase.error );
			}
		} );
	},

	handleRadioOne( event ) {
		this.setState( {
			questionOneRadio: event.currentTarget.value
		} );
	},

	handleRadioTwo( event ) {
		this.setState( {
			questionTwoRadio: event.currentTarget.value
		} );
	},

	renderCard() {
		const productName = getName( getPurchase( this.props ) );

		return (
			<CompactCard className="remove-purchase__card" onClick={ this.openDialog }>
				<a href="#">
					<Gridicon icon="trash" />
					{ this.translate( 'Remove %(productName)s', { args: { productName } } ) }
				</a>
			</CompactCard>
		);
	},

	renderDomainDialog() {
		const buttons = [ {
				action: 'cancel',
				disabled: this.state.isRemoving,
				label: this.translate( 'Cancel' )
			},
			{
				action: 'remove',
				disabled: this.state.isRemoving,
				isPrimary: true,
				label: this.translate( 'Remove Now' ),
				onClick: this.removePurchase
			} ],
			productName = getName( getPurchase( this.props ) );

		return (
			<Dialog
				buttons={ buttons }
				className="remove-purchase__dialog"
				isVisible={ this.state.isDialogVisible }
				onClose={ this.closeDialog }>
				<FormSectionHeading>{ this.translate( 'Remove %(productName)s', { args: { productName } } ) }</FormSectionHeading>
				{ this.renderDomainDialogText() }
			</Dialog>
		);
	},

	renderDomainDialogText() {
		const purchase = getPurchase( this.props ),
			productName = getName( purchase );

		return (
			<p>
				{
					this.translate( 'This will remove %(domain)s from your account.', {
						args: { domain: productName }
					} )
				}
				{ ' ' }
				{ this.translate( 'By removing, you are canceling the domain registration. This may stop you from using it again, even with another service.' ) }
			</p>
		);
	},

	renderPlanDialogs() {
		const buttons1 = [
			{
				action: 'cancel',
				disabled: this.state.isRemoving,
				label: this.translate( 'Cancel' )
			},
			{
				action: 'next-2',
				disabled: this.state.isRemoving || this.state.questionOneRadio == null || this.state.questionTwoRadio == null,
				label: this.translate( 'Next' ),
				onClick: this.displaySurveyTwo
			} ],
			buttons2 = [
				{
					action: 'cancel',
					disabled: this.state.isRemoving,
					label: this.translate( 'Cancel' )
				},
				{
					action: 'prev-1',
					disabled: this.state.isRemoving,
					label: this.translate( 'Previous' ),
					onClick: this.displaySurveyOne
				},
				{
					action: 'remove',
					disabled: this.state.isRemoving,
					isPrimary: true,
					label: this.translate( 'Remove' ),
					onClick: this.removePurchase
				} ],
			productName = getName( getPurchase( this.props ) );

		return (
			<div>
				<Dialog
					buttons={ buttons1 }
					className="remove-purchase__dialog"
					isVisible={ this.state.isDialogVisible && this.state.isSurveyOneVisible }
					onClose={ this.closeDialog }
					transitionEnter={ false }
					transitionLeave={ false }>
					<FormSectionHeading>{ this.translate( 'Remove %(productName)s', { args: { productName } } ) }</FormSectionHeading>
					{ this.renderQuestionOne() }
					{ this.renderQuestionTwo() }
				</Dialog>
				<Dialog
					buttons={ buttons2 }
					className="remove-purchase__dialog"
					isVisible={ this.state.isDialogVisible && this.state.isSurveyTwoVisible }
					onClose={ this.closeDialog }
					transitionEnter={ false }
					transitionLeave={ false }>
					<FormSectionHeading>{ this.translate( 'Remove %(productName)s', { args: { productName } } ) }</FormSectionHeading>
					{ config.isEnabled( 'upgrades/removal-survey' ) ? this.renderFreeformQuestion() : null }
					{ this.renderPlanDialogsText() }
				</Dialog>
			</div>
		);
	},

	renderPlanDialogsText() {
		const purchase = getPurchase( this.props ),
			productName = getName( purchase );

		let includedDomainText;
		if ( isPlan( purchase ) && hasIncludedDomain( purchase ) ) {
			includedDomainText = (
				<p>
					{
						this.translate(
							'The domain associated with this plan, {{domain/}}, will not be removed. It will remain active on your site, unless also removed.',
							{
								components: { domain: <em>{ getIncludedDomain( purchase ) }</em> }
							}
						)
					}
				</p>
			);
		}

		return (
			<div>
				<p>
					{
						this.translate( 'Are you sure you want to remove %(productName)s from {{siteName/}}?', {
							args: { productName },
							components: { siteName: <em>{ this.props.selectedSite.slug }</em> }
						} )
					}
					{ ' ' }
					{ isGoogleApps( purchase )
						? this.translate( 'Your Google Apps account will continue working without interruption. ' +
						'You will be able to manage your Google Apps billing directly through Google.'
					)
						: this.translate( 'You will not be able to reuse it again without purchasing a new subscription.', {
							comment: "'it' refers to a product purchased by a user"
						} )
					}

				</p>

				{ includedDomainText }
			</div>
		);
	},

	renderQuestionOne() {
		let reasons = {},
			ordered_reasons = [];

		let could_not_install_input = (
			<FormTextInput
				className="remove-purchase__reason-input"
				name="could_not_install_input"
				id="could_not_install_input"
				placeholder={ this.translate( 'What plugin/theme were you trying to install?' ) } />
		);
		reasons.could_not_install = (
			<FormLabel key="could_not_install">
				<FormRadio
					name="could_not_install"
					value="could_not_install"
					checked={ 'could_not_install' === this.state.questionOneRadio }
					onChange={ this.handleRadioOne } />
				<span>{ this.translate( 'I couldn\'t install a plugin/theme I wanted.' ) }</span>
				{ 'could_not_install' === this.state.questionOneRadio ? could_not_install_input : null }
			</FormLabel>
		);

		let too_hard_input = (
			<FormTextInput
				className="remove-purchase__reason-input"
				name="too_hard_input"
				id="too_hard_input"
				placeholder={ this.translate( 'Where did you run into problems?' ) } />
		);
		reasons.too_hard = (
			<FormLabel key="too_hard">
				<FormRadio
					name="too_hard"
					value="too_hard"
					checked={ 'too_hard' === this.state.questionOneRadio }
					onChange={ this.handleRadioOne } />
				<span>{ this.translate( 'It was too hard to set up my site.' ) }</span>
				{ 'too_hard' === this.state.questionOneRadio ? too_hard_input : null }
			</FormLabel>
		);

		let did_not_include_input = (
			<FormTextInput
				className="remove-purchase__reason-input"
				name="did_not_include_input"
				id="did_not_include_input"
				placeholder={ this.translate( 'What are we missing that you need?' ) } />
		);
		reasons.did_not_include = (
			<FormLabel key="did_not_include">
				<FormRadio
					name="did_not_include"
					value="did_not_include"
					checked={ 'did_not_include' === this.state.questionOneRadio }
					onChange={ this.handleRadioOne } />
				<span>{ this.translate( 'This upgrade didn\'t include what I needed.' ) }</span>
				{ 'did_not_include' === this.state.questionOneRadio ? did_not_include_input : null }
			</FormLabel>
		);

		let only_need_free_input = (
			<FormTextInput
				className="remove-purchase__reason-input"
				name="only_need_free_input"
				id="only_need_free_input"
				placeholder={ this.translate( 'Is there anything we can do to improve our upgrades?' ) } />
		);
		reasons.only_need_free = (
			<FormLabel key="only_need_free">
				<FormRadio
					name="only_need_free"
					value="only_need_free"
					checked={ 'only_need_free' === this.state.questionOneRadio }
					onChange={ this.handleRadioOne } />
				<span>{ this.translate( 'All I need is the free plan.' ) }</span>
				{ 'only_need_free' === this.state.questionOneRadio ? only_need_free_input : null }
			</FormLabel>
		);

		let another_reason_one_input = (
			<FormTextInput
				className="remove-purchase__reason-input"
				name="another_reason_one_input"
				id="another_reason_one_input" />
		);
		reasons.another_reason_one = (
			<FormLabel key="another_reason_one">
				<FormRadio
					name="another_reason_one"
					value="another_reason_one"
					checked={ 'another_reason_one' === this.state.questionOneRadio }
					onChange={ this.handleRadioOne } />
				<span>{ this.translate( 'Another reason…' ) }</span>
				{ 'another_reason_one' === this.state.questionOneRadio ? another_reason_one_input : null }
			</FormLabel>
		);

		for ( let i in this.state.questionOneOrder ) {
			ordered_reasons.push( reasons[this.state.questionOneOrder[i]] );
		}

		return (
			<div>
				<FormLegend>{ this.translate( 'Please tell us why you are canceling:' ) }</FormLegend>
				{ ordered_reasons }
			</div>
		);
	},

	renderQuestionTwo() {
		let reasons = {},
			ordered_reasons = [];

		reasons.staying_here = (
			<FormLabel key="staying_here">
				<FormRadio
					name="staying_here"
					value="staying_here"
					checked={ 'staying_here' === this.state.questionTwoRadio }
					onChange={ this.handleRadioTwo } />
				<span>{ this.translate( 'I\'m staying here and using the free plan.' ) }</span>
			</FormLabel>
		);

		let other_wordpress_input = (
			<FormTextInput
				className="remove-purchase__reason-input"
				name="other_wordpress_input"
				id="other_wordpress_input"
				placeholder={ this.translate( 'Mind telling us where?' ) } />
		);
		reasons.other_wordpress = (
			<FormLabel key="other_wordpress">
				<FormRadio
					name="other_wordpress"
					value="other_wordpress"
					checked={ 'other_wordpress' === this.state.questionTwoRadio }
					onChange={ this.handleRadioTwo } />
				<span>{ this.translate( 'I\'m going to use WordPress somewhere else.' ) }</span>
				{ 'other_wordpress' === this.state.questionTwoRadio ? other_wordpress_input : null }
			</FormLabel>
		);

		let different_service_input = (
			<FormTextInput
				className="remove-purchase__reason-input"
				name="different_service_input"
				id="different_service_input"
				placeholder={ this.translate( 'Mind telling us which one?' ) } />
		);
		reasons.different_service = (
			<FormLabel key="different_service">
				<FormRadio
					name="different_service"
					value="different_service"
					checked={ 'different_service' === this.state.questionTwoRadio }
					onChange={ this.handleRadioTwo } />
				<span>{ this.translate( 'I\'m going to use a different service for my website or blog.' ) }</span>
				{ 'different_service' === this.state.questionTwoRadio ? different_service_input : null }
			</FormLabel>
		);

		let no_need_input = (
			<FormTextInput
				className="remove-purchase__reason-input"
				name="no_need_input"
				id="no_need_input"
				placeholder={ this.translate( 'What will you do instead?' ) } />
		);
		reasons.no_need = (
			<FormLabel key="no_need">
				<FormRadio
					name="no_need"
					value="no_need"
					checked={ 'no_need' === this.state.questionTwoRadio }
					onChange={ this.handleRadioTwo } />
				<span>{ this.translate( 'I no longer need a website or blog.' ) }</span>
				{ 'no_need' === this.state.questionTwoRadio ? no_need_input : null }
			</FormLabel>
		);

		let another_reason_two_input = (
			<FormTextInput
				className="remove-purchase__reason-input"
				name="another_reason_two_input"
				id="another_reason_two_input" />
		);
		reasons.another_reason_two = (
			<FormLabel key="another_reason_two">
				<FormRadio
					name="another_reason_two"
					value="another_reason_two"
					checked={ 'another_reason_two' === this.state.questionOneRadio }
					onChange={ this.handleRadioOne } />
				<span>{ this.translate( 'Another reason…' ) }</span>
				{ 'another_reason_two' === this.state.questionOneRadio ? another_reason_two_input : null }
			</FormLabel>
		);

		for ( let i in this.state.questionTwoOrder ) {
			ordered_reasons.push( reasons[this.state.questionTwoOrder[i]] );
		}

		return (
			<div>
				<FormLegend>{ this.translate( 'Where is your next adventure taking you?' ) }</FormLegend>
				{ ordered_reasons }
			</div>
		);
	},

	renderFreeformQuestion() {
		return (
			<FormFieldset>
				<FormLabel>
					{ this.translate( 'What\'s one thing we could have done better? (optional)' ) }
					<FormTextarea name="improvement_input" id="improvement_input" />
				</FormLabel>
			</FormFieldset>
		);
	},

	render() {
		if ( isDataLoading( this.props ) || ! this.props.selectedSite ) {
			return null;
		}

		const purchase = getPurchase( this.props );
		if ( ! isRemovable( purchase ) ) {
			return null;
		}

		return (
			<span>
				{ this.renderCard() }
				{ isDomainRegistration( purchase ) ? this.renderDomainDialog() : this.renderPlanDialogs() }
			</span>
		);
	}
} );

export default RemovePurchase;
