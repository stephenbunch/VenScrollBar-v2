/**
 * venScrollbar jQuery Plugin v2.0.0
 * http://codecanyon.net/item/venscrollbar-a-jquery-scrollbar-plugin/118911
 * 
 * Copyright 2011, Stephen Bunch
 *
 * August 2011
 */

/**
 * @param {undefined} [undefined] A neat trick to turn undefined into a variable that can be minified.
 */
(function( $, window, nil, undefined ) {

/**
 * @param {object} [settings] An object containing settings to enable or disable plugin features.
 * 
 * @param {function} [ready] A callback to be executed in the context of the selected DOM element
 * after the plugin has finished initializing.
 */
$.fn["venScrollbar"] = function ( settings, ready ) {
	var defaults = {
		"anchor": true,				// handle anchor link click events

		"delta": {					// scroll increments in pixels
			"small": 40,
			"large": 100
		},

		"drag": false, 				// use the mouse to drag the body around

		"fx": {
			"autoHide": false,		// hide controls when idle
			"fadeIn": 200,			// duration of fadeIn in milliseconds
			"fadeOut": 400,			// duration of fadeOut in milliseconds
			"idle": 1000,			// milliseconds of inactivity to determine idle status
			"inertial": true, 		// enable inertial scrolling like on iOS devices
			"initHide": false,		// hide controls on initialization
			"lag": 0,				// delay before responding to scrollbar dragging
			"overlay": false,		// overlay controls over the viewport
			"smooth": false			// use animation to make scrolling smooth like in Firefox
		},

		"keyboard": true, 			// enable keyboard navigation support
		"live": true,				// poll for size changes instead of using refresh()
		"select": true, 			// enable content selection via the mouse
		"themeRoller": false,		// use jQuery UI ThemeRoller classes
		"touch": true,				// enable touch support
		"wheel": true,				// enable mousewheel support
		"wheelLock": false 			// disable mousewheel from scrolling the page
	};

	// Merge two objects recursively, modifying the first.
	defaults = $.extend( true, defaults, $.fn["venScrollbar"]["defaults"] );
	var options = $.extend( true, defaults, settings );

	return this.each(function() {
		var valid = ["auto", "scroll"],
			root = $( this ),
			body,
			viewport,
			xBar,
			yBar,
			controls,
			opt = $.extend( true, $.extend( true, { }, options ), {
				"overflow": {
					"x": root.css( "overflow-x" ),
					"y": root.css( "overflow-y" )
				}
			});

		// Skip elements that do not have overflow set to auto or scroll.
		if ( $.inArray( opt["overflow"]["x"], valid ) === -1 && $.inArray( opt["overflow"]["y"], valid ) === -1 ) {
			return;
		}

		root.addClass( "venscrollbar-root" ).contents().wrapAll( "<div class='venscrollbar-viewport'><div class='venscrollbar-body'> ");

		viewport = root.children();
		body = viewport.children();

		// Append each container element to the wrapper.
		var cursor = $( "<div class='venscrollbar-ui'>" ).appendTo( root ),
			childIndex = 0;
		$.each( "x > x-track x-bar < y > y-track y-bar < up down left right".split( " " ), function ( index, value ) {
			if ( value === ">" ) {
				cursor = cursor.children().eq( childIndex++ );
			} else if ( value === "<" ) {
				cursor = cursor.parent();
			} else {
				cursor.append( "<div class='venscrollbar-ui-" + value + "'>" );
			}
		});
		controls = $( "> .venscrollbar-ui", root );

		var	wake = (function() {
				var	timeoutID = 0,
					isIdle = Property( true, function() {
						if ( opt["fx"]["autoHide"] ) {
							if ( isIdle() ) {
								controls.fadeOut( opt["fx"]["fadeOut"] );
							} else {
								controls.fadeIn( opt["fx"]["fadeIn"] );
							}
						}

					}, function ( value ) {
						if ( !value ) {
							clearTimeout( timeoutID );
							timeoutID = setTimeout( function() {
								isIdle( true );
							}, opt["fx"]["idle"] );
						}
						return value;
					});

				return function() {
					isIdle( false );
				};

			})(),

			// Stops any inertial scrolling that may be going on.
			stopInertial = $.noop,

			/**
			 * @constructor
			 */
			ScrollBar = function ( axis ) {
				var	me = this,
					guid = $.guid++,
					activeClass = "venscrollbar-active",
					hoverClass = "venscrollbar-hover",

					// Selectors.
					wrap = controls.children().eq( axis - 1 ),
					bar = $( "> .venscrollbar-ui-" + ( axis === 1 ? "x" : "y" ) + "-bar", wrap ),
					track = $( "> .venscrollbar-ui-" + ( axis === 1 ? "x" : "y" ) + "-track", wrap ),
					prev = $( "> .venscrollbar-ui-" + ( axis === 1 ? "left" : "up" ), controls ),
					next = $( "> .venscrollbar-ui-" + ( axis === 1 ? "right" : "down" ), controls ),
					arrows = $( [ prev[0], next[0] ] ),

					opposite = function() {
						return axis === 1 ? yBar : xBar;
					},

					overflow = Property ( "visible", function() {
						visibility( me.isVisible() );
					}),

					// The maxium value of the scrollbar.
					limit = Property( 0, function() {
						// If the limit is shortened, then we need to move the scrollbar to the
						// nearest valid position.
						validate();
					}),

					// Bar size is being specified by the user.
					manual = bar[ axis === 1 ? "width" : "height" ]() !== 0,

					// Actual position of the scrollbar. If SMOOTH is true, then the
					// position may differ from the value. LATENCY may also affect the
					// position.
					position = Property( 0, function() {
						var prop = axis === 1 ? "left" : "top",
							offset = Math.round( position() / me.ratio * -1 ) + body.offsetParent().offset()[prop];

						// Update the position of the scrollbar element.
						bar.css( prop, Math.round( position() ) );

						// Update the position of the body. Multiply by -1 because the body needs to go in
						// the opposite direction than the scrollbar.
						// We need to use the .offset() function because weird things happen when the page
						// loads with a hash in the URL, and there is a corresponding anchor point in our
						// body element.
						body.offset({
							top: axis !== 1 ? offset : body.offset()["top"],
							left: axis === 1 ? offset : body.offset()["left"]
						});
					}),

					isEnabled = Property( false, function() {
						visibility( me.isVisible() );
						bar[ isEnabled() ? "removeClass" : "addClass" ]( "venscrollbar-state-disabled" );
					}),

					// Scrollbar { height | width } depending on axis.
					size = Property( 0, nil, function( value ) {
						if ( axis === 1 ) {
							bar.width( Math.round( value - ( bar.outerWidth() - bar.width() ) ) );
						} else {
							bar.height( Math.round( value - ( bar.outerHeight() - bar.height() ) ) );
						}
						return value;
					}),

					updateStyle = function() {
						// If overflow is set to auto and scrollbar is disabled, or if overflow
						// is set to hidden, then hide.
						$( [ wrap[0], prev[0], next[0] ] ).css( "display", me.isVisible() ? "block" : "none" );
					},

					visibility = Property( false, function() {
						updateStyle();

						// Upon hiding, update the opposite scrollbar's limit so that its track
						// spans the entire length. Upon showing, shorten its limit so that the
						// tracks don't intersect.
						var elems = [ opposite().wrap()[0], opposite().next()[0] ];
						if ( !opt["fx"]["overlay"] ) {
							elems.push( viewport[0] );
						}
						$( elems ).css( axis === 1 ? "bottom" : "right", ( me.isVisible() ? "+=" : "-=" ) + me.girth() );

						// onSizeChanged will not fire if the track is hidden, therefore the limit will not update.
						if ( !opt["fx"]["overlay"] || !opt["live"] ) {
							opposite().refresh();
						}
					}),

					onSizeChanged = function() {
						var outer = axis === 1 ? "outerWidth" : "outerHeight",
							inner = axis === 1 ? "innerWidth" : "innerHeight",
							
							// If the wrap size is set to 0, then use the viewport size.
							range = wrap[ axis === 1 ? "width" : "height" ]() || viewport[ inner ]();
						
						// If the scrollbar is a fixed size, then we need to set the
						// size of the bar and track, and then determine the ratio.
						// If not, we need to determine the ratio, and then set the
						// size of the bar and track.
						if ( manual ) {
							size( bar[ outer ]() );
							limit( range - size() );
							me.ratio = limit() / ( body[ outer ]() - viewport[ inner ]() );

						} else {
							me.ratio = range / body[ outer ]();
							size( me.ratio * viewport[ inner ]() );
							limit( range - size() );
						}

						me.pageSize = viewport[ inner ]();

						// Update isEnabled.
						isEnabled( body[ outer ]() > viewport[ inner ]() );
						validate();
					},

					onDrag = (function() {
						var mouseLastOK = 0;

						return function ( e ) {
							stopInertial();

							// Wake from idle.
							wake();

							var mousePosition = axis === 1 ? e.pageX : e.pageY,
								delta = axis === 1 ? e["delta"]["x"] : e["delta"]["y"];

							// Prevent the mouse from dragging the scrollbar when its position is not
							// the same as when it first clicked on the scrollbar.
							if ( !e["isNewDrag"] ) {
								if ( delta < 0 && mousePosition >= mouseLastOK || delta > 0 && mousePosition <= mouseLastOK ) {
									return;
								}
							}

							if ( me.val( me.val() + delta, 2 ) || e["isNewDrag"] ) {
								mouseLastOK = mousePosition;
							}
						};
					})(),

					// Used to animate the position from one value to another.
					slide = (function() {
						var rounds = 0,
							intervalID = 0,

							start = function() {
								intervalID = setInterval( function() {
									if ( rounds === 0 ) {
										clearInterval( intervalID );
										intervalID = 0;
										return;
									}
									position( position() + ( me.val() - position() ) / rounds );
									rounds--;
								}, $.fx.interval );
							},

							reset = function ( duration ) {
								// If there's no where to go, then don't do anyting.
								if ( Math.round( position() ) !== Math.round( me.val() ) ) {
									rounds = Math.round( duration / $.fx.interval );

									// If the loop isn't already running, start it.
									if ( intervalID === 0 ) {
										start();
									}
								}
							};

						return reset;
					})(),

					// Live support.
					live = Property( false, function() {
						if ( live() ) {
							var outer = axis === 1 ? "outerWidth" : "outerHeight",
								inner = axis === 1 ? "innerWidth" : "innerHeight";
							live[0] = Sink.propertychange.hook( viewport, onSizeChanged, inner );
							live[1] = Sink.propertychange.hook( body, onSizeChanged, outer );
							live[2] = Sink.propertychange.hook( wrap, onSizeChanged, outer );

							if ( manual ) {
								live[3] = Sink.propertychange.hook( bar, onSizeChanged, outer );
							}

						} else {
							$.each( live, function ( index, cookie ) {
								Sink.propertychange.unhook( cookie );
							});

							live_fixed( false );
						}
					}),

					// Touch support.
					touch = Property( false, function() {
						Sink.drag.unhook( touch[0] || 0 );
						touch[0] = Sink.drag.hook( bar, onDrag, touch(), true )["cookie"];
					}),

					// ThemeRoller support.
					themeRoller = Property( false, function() {
						if ( themeRoller() ) {
							activeClass = "ui-state-active";
							hoverClass = "ui-state-hover";
							uiStyles.enable();
						} else {
							activeClass = "venscrollbar-active";
							hoverClass = "venscrollbar-hover";
							uiStyles.disable();
						}
					}),

					readSettings = function() {
						overflow( axis === 1 ? opt[ "overflow" ]["x"] : opt[ "overflow" ]["y"] );
						live( opt["live"] );
						touch( opt["touch"] );
						themeRoller( opt["themeRoller"] );
					},

					validate = function() {
						me.val( me.val() < 0 ? 0 : me.val() > limit() ? limit() : undefined );
					};

				me.refresh = function() {
					readSettings();
					onSizeChanged();
					updateStyle();
				};

				// When FIXED is true, ratio is limit / (body size - viewport size).
				// When FIXED is false, ratio is track size / body size.
				me.ratio = 1,

				// The { top | left } position of scrollbar depending on axis.
				// Mode { 0 -> normal | 1 -> direct (set the value immediately) | 2 -> lag (delay for
				// FX.LAG before setting the value) }
				// Returns true if value was changed.
				me.val = Property( 0, function ( value, mode ) {
					// Trigger native scroll event.
					root.scroll();

					// When normal is true, we bypass whatever FX.SMOOTH is set to.
					if ( !opt["fx"]["smooth"] || mode ) {
						// Check for values smaller than 0 because FX.LAG is a user-inputted value.
						if ( mode === 1 || opt["fx"]["lag"] <= 0 ) {
							position( value );

						} else {
							// Implement lag.
							setTimeout( function() {
								slide( 130 );
							}, opt["fx"]["lag"] );
						}

					} else {
						// Implement smooth scrolling.
						slide( 130 );
					}
				}, function ( value ) {
					// If disabled, return 0. Otherwise, value cannot go outside the limit.
					return isEnabled() ? value < 0 ? 0 : value > limit() ? limit() : value : 0;
				});

				// Returns true if value was changed.
				me.end = function() {
					return me.val( limit() );
				};

				me.isVisible = function() {
					return isEnabled() || overflow() === "scroll";
				};

				me.girth = function() {
					return wrap[ axis === 1 ? "outerHeight" : "outerWidth" ]();
				};

				me.wrap = function() {
					return wrap;
				};

				me.next = function() {
					return next;
				};

				// Used for page-ups and page-downs.
				me.pageSize = 0;

				// Constructor code.
				fn.selectMode( wrap, false );
				fn.selectMode( next, false );
				fn.selectMode( prev, false );
				fn.selectMode( track, false );

				Sink.click.hook( next, function (e) {
					me.val( me.val() + opt["delta"]["small"] * me.ratio );
				});

				Sink.click.hook( prev, function() {
					me.val( me.val() - opt["delta"]["small"] * me.ratio );
				});

				Sink.click.hook( track, function ( e ) {
					var page = axis === 1 ? e.pageX : e.pageY,
						offset = bar.offset()[ axis === 1 ? "left" : "top" ];

					if ( page < offset ) {
						me.val( me.val() - me.pageSize * me.ratio );

					} else if ( page > offset + bar[ axis === 1 ? "outerWidth" : "outerHeight" ]() ) {
						me.val( me.val() + me.pageSize * me.ratio );

					} else {
						// Stop scrolling.
						return true;
					}
				});

				bar
					.hover( function() {
						bar.addClass( hoverClass );
					}, function() {
						bar.removeClass( hoverClass );
					})
					.mousedown( function() {
						bar.addClass( activeClass );
						uiRoot.bind( "mouseup.venScrollbar-" + guid, function() {
							uiRoot.unbind( "mouseup.venScrollbar-" + guid );
							bar.removeClass( activeClass );
						});
					});

				arrows
					.hover( function() {
						var $this = $( this ).addClass( hoverClass );
						if ( $this.data( "venScrollbar-isMouseDown" ) ) {
							$this.addClass( activeClass );
						}
					}, function() {
						$( this ).removeClass( hoverClass + " " + activeClass );
					})
					.mousedown( function() {
						var $this = $( this ).addClass( activeClass ).data( "venScrollbar-isMouseDown", true );
						uiRoot.bind( "mouseup.venScrollbar-" + guid, function() {
							uiRoot.unbind( "mouseup.venScrollbar-" + guid );
							$this.data( "venScrollbar-isMouseDown", false ).removeClass( activeClass );
						});
					});
			},

			anchorLinks = $(),

			onAnchorClicked = function ( e ) {
				stopInertial();

				var hash = $( this ).attr( "href" ),
					target = $( hash ),
					id = target.attr( "id" ),

					getOffset = function ( elem, prop ) {
						var offset = elem.position()[prop];
						if ( !elem.offsetParent().is( body ) ) {
							offset += getOffset( elem.offsetParent(), prop );
						}
						return offset;
					};

				// Position the scrollbar where it needs to be.
				xBar.val( getOffset( target, "left" ) * xBar.ratio );
				yBar.val( getOffset( target, "top" ) * yBar.ratio );

				// Temporarily remove the id from the target so we can update the
				// hash without having the window scroll.
				target.attr( "id", "" );
				window.location.hash = hash;
				target.attr( "id", id );

				// Prevent default and scroll to the top of the root element.
				$( window ).scrollTop( root.offset()["top"] );
				e.preventDefault();
			},

			onHashChanged = function() {
				var validElems = anchorLinks.filter( "a[href='" + window.location.hash + "']" );
				if ( validElems.length > 0 ) {
					onAnchorClicked.call( validElems[0], $.Event() );
				}
			},

			// Mousewheel support.
			wheel = Property( false, function() {
				if ( wheel() ) {
					wheel.cookie = Sink.mousewheel.hook( root, function ( e ) {
						// Don't override the zoom accessibility feature.
						if ( e.ctrlKey ) {
							return;
						}
						
						stopInertial();
						// Wake from idle.
						wake();

						var ui = e.shiftKey || e.axis === 1 ? xBar : yBar,
							hasChanged = ui.val( ui.val() + opt["delta"]["large"] * ui.ratio * (e.wheelDelta < 0 ? 1 : -1) );

						if ( opt["wheelLock"] || hasChanged ) {
							e["consume"]();
						}
					});

				} else {
					Sink.mousewheel.unhook( wheel.cookie );
				}
			}),

			// Touch and drag support.
			drag = Property( 0, function() {
				Sink.drag.unhook( drag.cookie || 0 );
				var obj = Sink.drag.hook( body, function ( e ) {
					// Wake from idle.
					wake();

					xBar.val( xBar.val() + e["delta"]["x"] * -xBar.ratio, 1 );
					yBar.val( yBar.val() + e["delta"]["y"] * -yBar.ratio, 1 );

				}, opt["touch"], opt["drag"], opt["fx"]["inertial"] );

				drag.cookie = obj["cookie"];
				stopInertial = obj["stopInertial"];
			}),

			// Keyboard support.
			keyboard = Property( false, function() {
				if ( keyboard() ) {
					root[0].tabIndex = 0;
					root.bind( "keydown.venScrollbar", function ( e ) {
						if ( e.keyCode > 31 && e.keyCode < 41 ) {
							stopInertial();

							// Wake from idle.
							wake();
						}

						var hasChanged = false,
							key = e.keyCode,
							small = opt["delta"]["small"];

						hasChanged =
							// spacebar
							key === 32 ? yBar.val( yBar.val() + yBar.pageSize * yBar.ratio * ( e.shiftKey ? -1 : 1 ) ) :
							// pageup
							key === 33 ? yBar.val( yBar.val() - yBar.pageSize * yBar.ratio ) :
							// pagedown
							key === 34 ? yBar.val( yBar.val() + yBar.pageSize * yBar.ratio ) :
							// end
							key === 35 ? yBar.end() :
							// home
							key === 36 ? yBar.val( 0 ) :
							// left
							key === 37 ? xBar.val( xBar.val() - small * xBar.ratio ) :
							// up
							key === 38 ? yBar.val( yBar.val() - small * yBar.ratio ) :
							// right
							key === 39 ? xBar.val( xBar.val() + small * xBar.ratio ) :
							// down
							key === 40 ? yBar.val( yBar.val() + small * yBar.ratio ) :
							false;

						if ( hasChanged || ( opt["wheelLock"] && key > 31 && key < 41 ) ) {
							e.preventDefault();
							e.stopPropagation();
						}
					});

				} else {
					root[0].tabIndex = -1;
					root.unbind( "keydown.venScrollbar" );
				}
			}),

			// Anchor support.
			anchor = Property( false, function() {
				if ( anchor() ) {
					anchor.cookie = Sink.hashchange.hook( window, onHashChanged );
				} else {
					Sink.hashchange.unhook( anchor.cookie );
				}

			}, function ( value ) {
				anchorLinks.unbind( "click.venScrollbar" );

				if ( value ) {
					// Override the click behavior of affecting anchor links.
					anchorLinks = body
						.find( "[id]" )
						.map(function() {
							var hash = "#" + $( this ).attr( "id" ),
								anchor = $( "a[href='" + hash + "']" );

							return anchor.length > 0 ? anchor[0] : nil;
						})
						.bind( "click.venScrollbar", onAnchorClicked );
				}

				return value;
			}),

			// Selection support.
			select = Property( nil, function() {
				if ( select() ) {
					viewport.bind( "mousedown.venScrollbar", function ( e ) {
						var intervalID = 0,
							xStep = 0,
							yStep = 0,
							elem = $( this ),
							offset = elem.offset(),
							limit = {
								top: offset["top"],
								left: offset["left"],
								bottom: offset["top"] + elem.height(),
								right: offset["left"] + elem.width()
							};

						uiRoot.bind( "mousemove.venScrollbar-select", function ( e ) {
							yStep = e.pageY < limit.top ? Math.floor( (e.pageY - limit.top) / 5 ) :
								e.pageY > limit.bottom ? Math.floor( (e.pageY - limit.bottom) / 5 ) :
								0;

							xStep = e.pageX < limit.left ? Math.floor( (e.pageX - limit.left) / 5 ) :
								e.pageX > limit.right ? Math.floor( (e.pageX - limit.right) / 5 ) :
								0;

							if ( xStep !== 0 || yStep !== 0 ) {
								if ( intervalID === 0 ) {
									intervalID = setInterval( function() {
										// Wake from idle.
										wake();

										xBar.val( xBar.val() + xStep );
										yBar.val( yBar.val() + yStep );
									}, 30 );
								}

							} else {
								clearInterval( intervalID );
								intervalID = 0;
							}

						}).bind( "mouseup.venScrollbar-select", function() {
							clearInterval( intervalID );
							uiRoot.unbind( ".venScrollbar-select" );
						});
					});

				} else {
					fn.selectMode( body, false );
					viewport.unbind( "mousedown.venScrollbar" );
				}
			}),

			autoHide = Property( false, function() {
				if ( autoHide() ) {
					root.bind( "mousemove.venScrollbar", wake );
				} else {
					root.unbind( "mousemove.venScrollbar" );
					controls.show();
				}
			}),

			readSettings = function() {
				wheel( opt["wheel"] );
				drag( ( opt["drag"] ? 1 : 0 ) | ( opt["touch"] ? 2 : 0 ) | ( opt["inertial"] ? 4 : 0 ) );
				keyboard( opt["keyboard"] );
				anchor( opt["anchor"] );
				autoHide( opt["fx"]["autoHide"] );

				// Selection support only if DRAG is false and we are not on a mobile device.
				select( opt["select"] && !opt["drag"] && !isMobile );
			};

		// Initialize scrollbars.
		xBar = new ScrollBar( 1 );
		yBar = new ScrollBar( 2 );
		xBar.refresh();
		yBar.refresh();

		// Although it'd be cool to use the CSS property and poll it for changes,
		// we'd limit ourselves in what we can do design-wise because everything
		// would have to be contained within the root element. We could be more
		// flexible if we used a regular variable and set overflow to visible.
		root.css( "overflow", "visible" );

		if ( opt["fx"]["initHide"] ) {
			controls.hide();
		}

		readSettings();

		// Go to anchor if applicable.
		if ( opt["anchor"] && window.location.hash !== "" ) {
			onHashChanged();
		}

		root.data( "venScrollbar", {
			"settings": opt,

			"refresh": function() {
				xBar.refresh();
				yBar.refresh();
				readSettings();
			},

			"scroll": function ( axis, distance ) {
				var ui = axis === 1 ? xBar : yBar;
				return ui.val( ui.val() + distance );
			},

			"version": "2.0.0"
		});

		var func = ready ? ready : settings;
		if ( $.isFunction( func ) ) {
			func.call( this, root.data( "venScrollbar" ), controls );
		}
	});
};

$.fn["venScrollbar"]["defaults"] = {};

var	isIE = !$.support.changeBubbles,

	// IE 8 and 7 don't support mouse events on the window object.
	uiRoot = $( isIE ? document : window ),

	// Although this isn't quite accurate since touch capability
	// is being added to the desktop, this will work for now.
	isMobile = uiRoot[0].ontouchstart !== undefined,

	// Miscellaneous functions.	
	fn = {
		unbox: function ( elem ) {
			return elem instanceof $ ? elem[0] : elem;
		},

		// Disables or enables text selection on an element.
		selectMode: function ( elem, enabled ) {
			elem = fn.unbox( elem );

			if ( isIE ) {
				var doNothing = enabled ? nil : function() {
					return false;
				};

				elem.onselectstart = doNothing;

				// Prevent images from being dragged around.
				$( "img", elem ).each( function() {
					this.ondragstart = doNothing;
				});

			} else {
				$( "img", elem ).add( elem )[ enabled ? "unbind" : "bind" ]( "mousedown.venScrollbar-noSelect", function ( e ) {
					if ( e.preventDefault ) {
						e.preventDefault();
					}
				});
			}
		},

		// Returns true if both variables have the same sign.
		sameSign: function ( a, b ) {
			return ( a >= 0 ) ^ ( b < 0 );
		}
	},

	/**
	 * @param {Function} [set] Convert incoming value.
	 */
	Property = function ( initialValue, onChange, set ) {
		set = set || $.noop;
		onChange = onChange || $.noop;

		return function ( value ) {
			if ( value === undefined ) {
				return initialValue;

			} else {
				var tmp = set( value );
				value = tmp !== undefined ? tmp : value;

				if ( value !== initialValue ) {
					initialValue = value;
					onChange.apply( this, arguments );
					return true;
				} else {
					return false;
				}
			}
		};
	},

	// Event template.
	Sink = function ( hook, unhook ) {
		var store = {};
		return {
			store: store,

			hook: function ( target, callback ) {
				return hook.apply( store, [ ( $.guid++ ).toString() ].concat( $.makeArray( arguments ) ) );
			},

			unhook: function ( cookie ) {
				unhook.apply( store, arguments );
			}
		};
	},

	// ThemeRoller style magic.
	uiStyles = (function() {
		
		var	styleRules = [],
			isLoading = false,
			elem = $(),
			count = 4,
			users = 0,
			ready = function() {
				if ( users === 0 ) {
					elem = $( "<style type='text/css'>" + styleRules.join( "" ) + "</style>" ).appendTo("head");
				}
				users++;
			};

		return {
			enable: function() {
				if ( isIE ) {
					return;
				}

				if ( count === 0 ) {
					ready();
				}

				if ( !isLoading ) {
					isLoading = true;
					var div = $("<div style='display:none'>").appendTo( "body" );

					$.each( "ui-state-default ui-state-hover ui-state-active ui-widget-content".split( " " ), function ( i, selector ) {
						var url = div.addClass( selector ).css( "background-image" ).match( /url\((?:"|')?([^"]+)(?:"|')?\)/ ),
							img = new Image(),
							triggerReady = function () {
								if ( --count === 0 ) {
									ready();
								}
							};

						if ( url && url.length > 1 ) {
							url = url[1];
						} else {
							triggerReady();
						}
						div.removeClass( selector );

						img.onload = function() {
							var c = $( "<canvas width='" + img.height + "' height='" + img.width + "'>" )[0],
								ctx = c.getContext( "2d" );

							ctx.translate( 0, img.width );
							ctx.rotate( -90 * Math.PI / 180 );
							ctx.drawImage( img, 0, 0, img.width, img.height );
							styleRules[i] = ".ui-flip." + selector + "{background:" + "url(" + c.toDataURL() + ") repeat-y 50% 50%}";
							
							triggerReady();
						}
						img.onerror = triggerReady;
						img.src = url;
					});

					div.remove();
				}
			},

			disable: function() {
				elem.remove();
				users--;
			}
		};

	})();

	// Mousewheel event.
	Sink.mousewheel = Sink( function ( cookie, target, callback ) {
		var	elem = fn.unbox( target ),
			callbackWrapper = function ( e ) {
				e = e || window.event;
			
				var event = {
					shiftKey: e.shiftKey,
					ctrlKey: e.ctrlKey,

					// Normalize values: -1 -> down, 1 -> up.
					// IE uses e.wheelDelta. Everyone else uses e.detail.
					wheelDelta:
							e.wheelDelta ?
								e.wheelDelta > 0 ? 1 :
								e.wheelDelta < 0 ? -1 :
								0 :
							e.detail ?
								e.detail > 0 ? -1 :
								e.detail < 0 ? 1 :
								0 :
							0,

					"consume": function() {
						// Keep the document from scrolling.
						// IE9, Chrome, Safari, Firefox, Opera.
						if ( e.preventDefault ) {
							e.preventDefault();
						}
						// IE 8.
						e.cancel = true;
						// IE 7.
						e.returnValue = false;

						// Keep the event from bubbling up.
						if ( e.stopPropagation ) {
							e.stopPropagation();
						}
						e.cancelBubble = true;
					},

					// Firefox uses e.axis. Webkit uses e.wheelDeltaX.
					axis: e.axis ? e.axis : e.wheelDeltaX ? 1 : 2
			};

			// Invoke the user's event handler, passing the custom event object.
			callback.call( elem, event );
		};

		if ( elem.addEventListener ) {
			elem.addEventListener( "mousewheel", callbackWrapper, false );
			// Firefox.
			elem.addEventListener( "DOMMouseScroll", callbackWrapper, false );
		} else {
			// IE.
			elem.onmousewheel = callbackWrapper;
		}

		this[ cookie ] = [ elem, callbackWrapper ];
		return cookie;

	}, function ( cookie ) {
		if ( data = this[cookie] ) {
			if ( data[0].removeEventListener ) {
				data[0].removeEventListener( "mousewheel", data[1], false );
				// Firefox.
				data[0].removeEventListener( "DOMMouseScroll", data[1], false );
			} else {
				// IE.
				data[0].onmousewheel = nil;
			}
			delete this[ cookie ];
		}
	});

	// Drag event.
	Sink.drag = Sink( function ( cookie, target, callback, mobileOn, desktopOn, inertialOn ) {
		var elem = fn.unbox( target ),
			coord = nil,
			isNewDrag = true,

			inertial = (function() {

				var velocity = { x: 0, y: 0 },
					distance = { x: 0, y: 0 },
					timeStart = { x: 0, y: 0 },
					drag = 0.05,
					amplify = 20,
					frameRef = 0,
					animationID = 0,
					isIdle = false,
					idleTimeoutID,

					animation = function() {
						frameRef++;
						var x = Math.pow( 2, -(drag * frameRef) ) * velocity.x,
							y = Math.pow( 2, -(drag * frameRef) ) * velocity.y;

						if ( Math.round( x ) === 0 && Math.round( y ) === 0 || coord === nil ) {
							// Stop the animation and exit.
							clearInterval( animationID );
							return;
						}

						var event = {
							"delta": {
								"x": x < 0 ? Math.ceil( x ) : Math.floor( x ),
								"y": y < 0 ? Math.ceil( y ) : Math.floor( y )
							},
							pageY: coord.y,
							pageX: coord.x,
							"isNewDrag": false
						};

						callback.call( elem, event );
					};

				return {	
					start: function() {
						// Stop the animation.
						clearInterval( animationID );

						distance = { x: 0, y: 0 };
						var time = $.now();
						timeStart = {
							x: time,
							y: time
						};
					},

					capture: function ( delta ) {
						// Reset if direction changes.
						var time = $.now();
						if ( distance.x !== 0 && !fn.sameSign( delta["x"], distance.x ) ) {
							distance.x = 0;
							timeStart.x = time;
						}
						if ( distance.y !== 0 && !fn.sameSign( delta["y"], distance.y ) ) {
							distance.y = 0;
							timeStart.y = time;
						}

						// Update distance.
						distance.x += delta["x"];
						distance.y += delta["y"];

						isIdle = false;
						clearTimeout( idleTimeoutID );
						idleTimeoutID = setTimeout( function() {
							isIdle = true;
						}, 30);
					},

					stop: function() {
						// Bypass inertial scrolling if the user didn't let go as if to throw the page.
						if ( isIdle ) {
							return;
						}

						var now = $.now();

						velocity.x = Math.pow( Math.abs( distance.x / (now - timeStart.x) ), 2.3 ) * amplify;
						velocity.y = Math.pow( Math.abs( distance.y / (now - timeStart.y) ), 2.3 ) * amplify;

						if ( !fn.sameSign( velocity.x, distance.x ) ) {
							velocity.x *= -1;
						}
						if ( !fn.sameSign( velocity.y, distance.y ) ) {
							velocity.y *= -1;
						}

						// Start the animation.
						frameRef = 0;
						animationID = setInterval( animation, $.fx.interval );
					},

					clear: function() {
						clearInterval( animationID );
					}
				};
			})(),

			onMouseDown = function() {
				uiRoot
					.bind( "mousemove.venScrollbar-drag", onMouseMove )
					.bind( "mouseup.venScrollbar-drag", function() {
						uiRoot.unbind( ".venScrollbar-drag" );
						if ( inertialOn ) {
							inertial.stop();
						}
					});

				coord = nil;
				isNewDrag = true;

				if ( inertialOn ) {
					inertial.start();
				}
			},

			onMouseMove = function ( e ) {
				if ( coord !== nil ) {
					var event = {
						"delta": {
							"x": Math.floor( e.pageX - coord.x ),
							"y": Math.floor( e.pageY - coord.y )
						},
						pageY: e.pageY,
						pageX: e.pageX,
						"isNewDrag": isNewDrag
					};

					if ( inertialOn ) {
						inertial.capture( event["delta"] );
					}

					isNewDrag = false;

					callback.call( elem, event );
				}

				coord = {
					x: e.pageX,
					y: e.pageY
				};
			};

		if ( isMobile && mobileOn ) {
			// Mobile support.
			elem.ontouchstart = function() {
				if ( isNewDrag ) {
					coord = nil;
					if ( inertialOn ) {
						inertial.start();
					}
				}
			};

			elem.ontouchend = function ( e ) {
				if ( e.targetTouches.length === 0 ) {
					if ( inertialOn ) {
						inertial.stop();
					}
					isNewDrag = true;
				}
			};

			elem.ontouchmove = function ( e ) {
				if ( e.targetTouches.length === 1 ) {
					e.preventDefault();
					onMouseMove({
						pageX: e.targetTouches[0].pageX,
						pageY: e.targetTouches[0].pageY
					});
				}
			};

		} else if ( desktopOn ) {
			// Desktop support.
			$( elem ).bind( "mousedown.venScrollbar-drag", onMouseDown );

			// Disable text selection.
			fn.selectMode( elem, false );
		}

		this[ cookie ] = [ elem, inertial.clear ];
		return {
			"cookie": cookie,
			"stopInertial": inertial.clear
		};

	}, function ( cookie ) {
		if ( data = this[cookie] ) {
			$( data[0] ).unbind( ".venScrollbar-drag" );

			// Enable text selection.
			fn.selectMode( data[0], true );

			delete this[cookie];
		}
	});

	// Propertychange event.
	Sink.propertychange = Sink( function ( cookie, target, callback, property) {
		var	get = $.isFunction( target[property] ) ? function() {
				return target[ property ]();
			} : function() {
				return target[ property ];
			},

			value = Property( get(), function() {
				callback.call( target );
			});

		this[ cookie ] = setInterval( function() {
			value( get() );
		}, 50);

		return cookie;

	}, function ( cookie ) {
		if ( data = this[cookie] ) {
			clearInterval( data );
			delete this[cookie];
		}
	});

	// Hashchange event.
	Sink.hashchange = Sink( function ( cookie, elem, callback ) {
		var data = this;
		if ( $.isEmptyObject( data ) ) {
			var masterCallback = function() {
				$.each( data, function ( key, value ) {
					value();
				});
			};

			if ( elem.addEventListener ) {
				elem.addEventListener( "hashchange", masterCallback, false );
			} else if ( "onhashchange" in elem && navigator.userAgent.indexOf("MSIE 7.0") === -1 ) {
				// Unfortunately, IE7 has the onhashchange event, but it doesn't do anything.
				elem.onhashchange = masterCallback;
			} else {
				Sink.propertychange.hook( window.location, masterCallback, "hash" );
			}
		}

		data[cookie] = callback;
		return cookie;

	}, function ( cookie ) {
		delete this[cookie];
	});

	// Enhanced click event.
	Sink.click = Sink( function ( cookie, elem, callback ) {
		var timeoutID = 0,
			isFirstRun = true,
			isPaused = false,
			isStarted = false,
			isCancelled = false,
			$elem = $( elem ),
			event,
			run = function () {
				isStarted = true;
				if ( !callback( event ) ) {
					timeoutID = setTimeout( function() {
						run();
					}, isFirstRun ? 410 : 30);
				} else {
					isCancelled = true;
				}
				isFirstRun = false;
			},
			
			stop = function() {
				clearTimeout( timeoutID );
				isFirstRun = true;
				isPaused = false;
				isStarted = false;
				isCancelled = false;
				$elem.unbind( "mousemove.venScrollbar-click" );
			},
			
			pause = function() {
				clearTimeout( timeoutID );
				isPaused = true;
			};

		$elem
			.bind( "mousedown.venScrollbar-click", function ( e ) {
				$elem.bind( "mousemove.venScrollbar-click", function ( e ) {
					event = e;
					if ( isCancelled ) {
						isCancelled = false;
						run();
					}
				});
				event = e;
				run();
			})
			.bind( "mouseup.venScrollbar-click", stop )
			.bind( "mouseleave.venScrollbar-click", function () {
				if ( isStarted ) {
					pause();
				}
			})
			.bind( "mouseenter.venScrollbar-click", function ( e ) {
				if ( isPaused ) {
					event = e;
					run();
				}
			});

		uiRoot.bind( "mouseup.venScrollbar-click", stop );

		this[ cookie ] = elem;
		return cookie;

	}, function ( cookie ) {
		if ( elem = this[cookie] ) {
			$( elem ).unbind( "venScrollbar-click" );
			delete this[cookie];
		}
	});

})( jQuery, window, null );
