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
		themeRoller: true

	}, function( data, ui ) {
		var	bars = $( ".venscrollbar-ui-x-bar, .venscrollbar-ui-y-bar", ui )
			.addClass( "ui-state-default" )
			.each( function ( index ) {
				$( this ).append( "<span class='ui-icon ui-icon-grip-solid-" + ( index === 0 ? "vertical" : "horizontal" ) + "' style='bottom:0;left:0;right:0;top:0;margin:auto;position:absolute'>" );
			})
			.eq( 1 ).addClass( "ui-flip" );

		var arrows = $( ".venscrollbar-ui-left, .venscrollbar-ui-right, .venscrollbar-ui-up, .venscrollbar-ui-down", ui )
			.addClass( "ui-state-default" )
			.each( function ( index ) {
				$( this ).append( "<span class='ui-icon ui-icon-triangle-1-" + ( index === 0 ? "n" : index === 1 ? "s" : index === 2 ? "w" : "e" ) + "'>" );
			})
			.slice( 2 )
			.addClass( "ui-flip" );
					
		$( ".venscrollbar-ui-x-track, .venscrollbar-ui-y-track", ui )
			.addClass( "ui-widget-content" )
			.eq( 1 )
			.addClass( "ui-flip" );

		data.refresh();
	});
});
