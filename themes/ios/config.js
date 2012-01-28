/**
 * venScrollbar jQuery Plugin v2.0.0
 * http://codecanyon.net/item/venscrollbar-a-jquery-scrollbar-plugin/118911
 * 
 * Copyright 2011, Stephen Bunch
 *
 * August 2011
 */
$( document ).ready( function() {
	$( "#box" ).venScrollbar({
		autoHide: true,
		overlay: true,
		arrows: false

	}, function ( data, ui ) {
		$( ".venscrollbar-ui-y-bar", ui ).append( "<div class='end-top'/><div class='middle-y'/><div class='end-bottom'/>" );
		$( ".venscrollbar-ui-x-bar", ui ).append( "<div class='end-left'/><div class='middle-x'/><div class='end-right'/>" );
	});
});