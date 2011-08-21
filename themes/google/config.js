/**
 * venScrollbar jQuery Plugin v2.0.0
 * http://codecanyon.net/item/venscrollbar-a-jquery-scrollbar-plugin/118911
 * 
 * Copyright 2011, Stephen Bunch
 *
 * August 2011
 */
$( document ).ready( function() {
	$( "#box" ).venScrollbar( function ( data, ui ) {
		$( ".venscrollbar-ui-y-bar, .venscrollbar-ui-up, .venscrollbar-ui-down", ui ).append( "<div class='y-a'/><div class='y-b'/><div class='y-c'/>" );
		$( ".venscrollbar-ui-x-bar, .venscrollbar-ui-left, .venscrollbar-ui-right", ui ).append( "<div class='x-a'/><div class='x-b'/><div class='x-c'/>" );
		$( ".venscrollbar-ui-x-bar, .venscrollbar-ui-y-bar", ui ).append( "<div class='grip'>" );
		$( ".venscrollbar-ui-up, .venscrollbar-ui-down, .venscrollbar-ui-left, .venscrollbar-ui-right", ui ).append( "<div class='decor'>" );
	});
});