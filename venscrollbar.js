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
		"anchor": true,			// handle anchor link click events
		"arrows": true,			// inject HTML for arrows
		"autoHide": false,		// hide controls when idle
		"deltaSmall": 40,		// scroll increment when using arrows or arrow keys
		"deltaLarge": 100,		// scroll increment when using the mousewheel
		"drag": false, 			// use the mouse to drag the body around	
		"fadeIn": 200,			// duration of fadeIn in milliseconds
		"fadeOut": 400,			// duration of fadeOut in milliseconds
		"idle": 1000,			// milliseconds of inactivity to determine idle status
		"inertial": true, 		// enable inertial scrolling like on iOS devices
		"initHide": false,		// hide controls on initialization
		"keyboard": true, 		// enable keyboard navigation support
		"lag": 0,				// delay before responding to scrollbar dragging
		"live": true,			// poll for size changes instead of using refresh()
		"overlay": false,		// overlay controls over the viewport
		"select": true, 		// enable text selection
		"smooth": false,		// enable smooth scrolling
		"stealFocus": false, 	// always consume mousewheel and touch events
		"themeRoller": false,	// enable jQuery UI ThemeRoller support
		"touch": true,			// enable touch support
		"track": true,			// inject HTML for track
		"wheel": true			// enable mousewheel support
	};

	// Merge two objects, modifying the first.
	defaults = $.extend( defaults, $.fn["venScrollbar"]["defaults"] );
	var options = $.extend( defaults, settings );

	return this.each(function() {
		var valid = ["auto", "scroll"],
			root = $( this ),
			body,
			viewport,
			xBar,
			yBar,
			controls,
			opt = $.extend( $.extend( { }, options ), {
				"overflowX": root.css( "overflow-x" ),
				"overflowY": root.css( "overflow-y" )
			});

		// Skip elements that do not have overflow set to auto or scroll.
		if ( $.inArray( opt["overflowX"], valid ) === -1 && $.inArray( opt["overflowY"], valid ) === -1 ) {
			return;
		}

		// We may be initializing an empty container, in which case wrapAll won't do anything.
		var wrap = "<div class='venscrollbar-viewport'><div class='venscrollbar-body'>";
		if ( root.addClass( "venscrollbar-root" ).contents().length > 0 ) {
			root.contents().wrapAll( wrap );
		} else {
			root.append( wrap );
		}

		viewport = root.children();
		body = viewport.children();

		// Append each container element to the wrapper.
		var cursor = $( "<div class='venscrollbar-ui'>" ).appendTo( root ),
			childIndex = 0;
		$.each( "x > x-bar < y > y-bar".split( " " ), function ( index, value ) {
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
						if ( opt["autoHide"] ) {
							if ( isIdle() ) {
								controls.fadeOut( opt["fadeOut"] );
							} else {
								controls.fadeIn( opt["fadeIn"] );
							}
						}

					}, function ( value ) {
						if ( !value ) {
							clearTimeout( timeoutID );
							timeoutID = setTimeout( function() {
								isIdle( true );
							}, opt["idle"] );
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
					prev = $(),
					next = $(),

					opposite = function() {
						return axis === 1 ? yBar : xBar;
					},

					overflow = Property( "visible", function() {
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

					// Unfortunately, the browser's implementation of the hash is whack, so we also
					// need this method to be invokeable when we're handling the hashchange ourselves.
					onPositionChanged = function() {
						var prop = axis === 1 ? "left" : "top",
							offset = Math.round( position() / me.ratio * -1 ) + body.offsetParent().offset()[prop];

						// Update the position of the scrollbar element.
						bar.css( prop, Math.round( position() ) );

						// Update the position of the body. Multiply by -1 because the body needs to go in
						// the opposite direction than the scrollbar.
						// We cannot rely on CSS top and left because the browser will do whatever it
						// takes to get that element in view, one of which is screwing with the offset.
						// This problem is easily seen when the page loads with a hash in the url, and there
						// is a corresponding anchor point in our body element.
						body.offset({
							top: axis === 2 ? offset : body.offset()["top"],
							left: axis === 1 ? offset : body.offset()["left"]
						});
					},

					// Actual position of the scrollbar. If SMOOTH is true, then the position
					// may differ from the value. LATENCY may also affect the position.
					position = Property( 0, onPositionChanged),

					isEnabled = Property( false, function() {
						visibility( me.isVisible() );
						bar[ isEnabled() ? "removeClass" : "addClass" ]( "venscrollbar-disabled" );
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
						wrap.add( prev ).add( next ).css( "display", me.isVisible() ? "block" : "none" );
					},

					visibility = Property( false, function() {
						updateStyle();

						// Upon hiding, update the opposite scrollbar's limit so that its range
						// spans the entire length. Upon showing, shorten its limit so that the
						// scrollbars don't intersect.
						var elems = opposite().wrap().add( opposite().next() );
						if ( !opt["overlay"] ) {
							elems = elems.add( viewport );
						}
						elems.css( axis === 1 ? "bottom" : "right", ( me.isVisible() ? "+=" : "-=" ) + me.girth() );

						// onSizeChanged will not fire if LIVE is disabled.
						if ( !opt["live"] ) {
							opposite().refresh();
						}
					}),

					onSizeChanged = function() {
						var outer = axis === 1 ? "outerWidth" : "outerHeight",
							inner = axis === 1 ? "innerWidth" : "innerHeight",
							dimen = axis === 1 ? "width" : "height";

						if ( root[0].style[ dimen ] === "auto" ) {
							root[ dimen ]( body[ outer ]() );
						}
							
						// If the wrap size is set to 0, then use the viewport size.
						var range = wrap[ dimen ]() || viewport[ inner ]();
						
						// If the plugin uses a fixed bar size, we need to calculate the
						// ratio after setting the size and limit. Otherwise, we need to 
						// calculate the ratio before setting the size and limit.
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

					bindArrows = Property( false, function() {
						if ( bindArrows() ) {
							prev = $( "> .venscrollbar-ui-" + ( axis === 1 ? "left" : "up" ), controls );
							next = $( "> .venscrollbar-ui-" + ( axis === 1 ? "right" : "down" ), controls );

							fn.selectMode( prev, false );
							fn.selectMode( next, false );

							Sink.click.hook( next, function (e) {
								me.val( me.val() + opt["deltaSmall"] * me.ratio );
							});

							Sink.click.hook( prev, function() {
								me.val( me.val() - opt["deltaSmall"] * me.ratio );
							});

							prev
								.add( next )
								.hover( function() {
									var $this = $( this ).addClass( hoverClass );
									if ( $this.data( "venScrollbar-isMouseDown" ) ) {
										$this.addClass( activeClass );
									}
								}, function() {
									$( this ).removeClass( hoverClass + " " + activeClass );
								})
								.mousedown( function ( e ) {
									var $this = $( this ).addClass( activeClass ).data( "venScrollbar-isMouseDown", true );
									uiRoot.on( "mouseup.venScrollbar-" + guid, function() {
										uiRoot.off( "mouseup.venScrollbar-" + guid );
										$this.data( "venScrollbar-isMouseDown", false ).removeClass( activeClass );
									});

									// For browsers like Chrome, this ensures that the user can't select anything.
									if ( e.preventDefault ) {
										e.preventDefault();
									}
									return false;
								});
						}
					}),

					bindTrack = Property( false, function() {
						if ( bindTrack() ) {
							fn.selectMode( track, false );
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

							// For browsers like Chrome, this ensures that the user can't select anything.
							track.mousedown( function ( e ) {
								if ( e.preventDefault ) {
									e.preventDefault();
								}
								return false;
							});
						}
					}),

					readSettings = function() {
						bindArrows( opt["arrows"] );
						bindTrack( opt["track"] );
						overflow( axis === 1 ? opt["overflowX"] : opt["overflowY"] );
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
				// When FIXED is false, ratio is wrap size / body size.
				me.ratio = 1;

				// The { top | left } position of scrollbar depending on axis.
				// Mode { 0 -> normal | 1 -> direct (set the value immediately) | 2 -> lag (delay for
				// FX.LAG before setting the value) }
				// Returns true if value was changed.
				me.val = Property( 0, function ( value, mode ) {
					// Trigger native scroll event.
					root.scroll();

					// When normal is true, we bypass whatever FX.SMOOTH is set to.
					if ( !opt["smooth"] || mode ) {
						// Check for values smaller than 0 because FX.LAG is a user-inputted value.
						if ( mode === 1 || opt["lag"] <= 0 ) {
							position( value );

						} else {
							// Implement lag.
							setTimeout( function() {
								slide( 130 );
							}, opt["lag"] );
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

				me.isEnabled = function() {
					return isEnabled();
				};

				// Ensure that everything is where it should be. Needed to combat the browser's
				// hashchange hack job.
				me.ensurePosition = function() {
					onPositionChanged();
				};

				// Used for page-ups and page-downs.
				me.pageSize = 0;

				// Constructor code.
				readSettings();

				fn.selectMode( wrap, false );

				bar
					.hover( function() {
						bar.addClass( hoverClass );
					}, function() {
						bar.removeClass( hoverClass );
					})
					.mousedown( function ( e ) {
						bar.addClass( activeClass );
						uiRoot.on( "mouseup.venScrollbar-" + guid, function() {
							uiRoot.off( "mouseup.venScrollbar-" + guid );
							bar.removeClass( activeClass );
						});

						// For browsers like Chrome, this ensures that the user can't select anything.
						if ( e.preventDefault ) {
							e.preventDefault();
						}
						return false;
					});
			},

			anchorLinks = $(),

			onAnchorClicked = function ( e ) {
				stopInertial();

				var hash = $( this ).attr( "href" ),
					target = $( hash ),

					getOffset = function ( elem, prop ) {
						var offset = elem.position()[prop];
						if ( !elem.offsetParent().is( body ) ) {
							offset += getOffset( elem.offsetParent(), prop );
						}
						return offset;
					},
					
					childModules = target.parentsUntil( root ).filter( "div.venscrollbar-root" );

				if ( childModules.length > 0 ) {
					target = childModules.eq( 0 );
				} else {
					// If we don't check to see if they're different, we will leave the
					// silent editing in an unfinished state.
					if ( window.location.hash !== hash ) {
						Sink.hashchange.silentEdit( target.attr( "id" ) );
					}
				}

				// Position the scrollbar where it needs to be.
				xBar.val( getOffset( target, "left" ) * xBar.ratio );
				yBar.val( getOffset( target, "top" ) * yBar.ratio );

				// If the root container is the window, then scroll the window.
				// Otherwise, let the outer scrollbar do its thing.
				if ( root.parents( "div.venscrollbar-root" ).length === 0 ) {
					// Prevent default and scroll to the top of the root element.
					$( window ).scrollTop( root.offset()["top"] );
					$( window ).scrollLeft( root.offset()["left"] );
					e.preventDefault();
				}
			},

			onHashChanged = function ( e ) {
				var validElems = anchorLinks.filter( "a[href='" + window.location.hash + "']" );
				if ( validElems.length > 0 ) {
					onAnchorClicked.call( validElems[0], $.Event() );

					// Ideally, we would just call e.preventDefault(), but that doesn't seem to
					// mean anything for the hashchange event.
					xBar.ensurePosition();
					yBar.ensurePosition();
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

						// Scroll horizontally if the shift key is held down, or if the vertical scrollbar
						// is disabled.
						var ui = e.shiftKey || e.axis === 1 || !yBar.isEnabled() ? xBar : yBar,
							hasChanged = ui.val( ui.val() + opt["deltaLarge"] * ui.ratio * (e.wheelDelta < 0 ? 1 : -1) );

						if ( opt["stealFocus"] || hasChanged ) {
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

				}, opt["touch"], opt["drag"], opt["inertial"] );

				drag.cookie = obj["cookie"];
				stopInertial = obj["stopInertial"];
			}),

			// Keyboard support.
			keyboard = Property( false, function() {
				if ( keyboard() ) {
					root[0].tabIndex = 0;
					root.on( "keydown.venScrollbar", function ( e ) {
						if ( e.keyCode > 31 && e.keyCode < 41 ) {
							stopInertial();

							// Wake from idle.
							wake();
						}

						var hasChanged = false,
							key = e.keyCode,
							small = opt["deltaSmall"];

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

						if ( hasChanged || ( opt["stealFocus"] && key > 31 && key < 41 ) ) {
							e.preventDefault();
							e.stopPropagation();
						}
					});

				} else {
					root[0].tabIndex = -1;
					root.off( "keydown.venScrollbar" );
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
				anchorLinks.off( "click.venScrollbar" );

				if ( value ) {
					// Override the click behavior of affecting anchor links.
					anchorLinks = body
						.find( "[id]" )
						.map(function() {
							var hash = "#" + $( this ).attr( "id" ),
								anchor = $( "a[href='" + hash + "']" );

							return anchor.length > 0 ? anchor[0] : nil;
						})
						.on( "click.venScrollbar", onAnchorClicked );
				}

				return value;
			}),

			// Selection support.
			select = Property( nil, function() {
				if ( select() ) {
					viewport.on( "mousedown.venScrollbar", function ( e ) {
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

						uiRoot.on( "mousemove.venScrollbar-select", function ( e ) {
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

						}).on( "mouseup.venScrollbar-select", function() {
							clearInterval( intervalID );
							uiRoot.off( ".venScrollbar-select" );
						});
					});

				} else {
					fn.selectMode( body, false );
					viewport.off( "mousedown.venScrollbar" );
				}
			}),

			autoHide = Property( false, function() {
				if ( autoHide() ) {
					root.on( "mousemove.venScrollbar", wake );
				} else {
					root.off( "mousemove.venScrollbar" );
					controls.show();
				}
			}),

			injectArrows = Property( false, function() {
				var items = "up down left right".split( " " );
				if ( injectArrows() ) {
					$.each( items, function ( index, value ) {
						controls.append( "<div class='venscrollbar-ui-" + value + "'>" );
					});
				} else {
					$( $.map( items, function ( value ) { return ".venscrollbar-ui-" + value; }).join( "," ), controls ).remove();
				}
			}),

			injectTrack = Property( false, function() {
				var items = "venscrollbar-ui-x venscrollbar-ui-y".split( " " );
				if ( injectTrack() ) {
					$.each( items, function ( index, value ) {
						// Use prepend instead of append so that the track displays underneath the bar.
						$( "." + value, controls ).prepend( "<div class='" + value + "-track'>" );
					});
				} else {
					$( $.map( items, function ( value ) { return "." + value + "-track"; }).join( "," ), controls ).remove();
				}
			}),

			readSettings = function() {
				injectArrows( opt["arrows"] );
				injectTrack( opt["track"] );
				wheel( opt["wheel"] );
				drag( ( opt["drag"] ? 1 : 0 ) | ( opt["touch"] ? 2 : 0 ) | ( opt["inertial"] ? 4 : 0 ) );
				keyboard( opt["keyboard"] );
				anchor( opt["anchor"] );
				autoHide( opt["autoHide"] );

				// Selection support only if DRAG is false and we are not on a mobile device.
				select( opt["select"] && !opt["drag"] && !isMobile );
			};

		readSettings();

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

		if ( opt["initHide"] ) {
			controls.hide();
		}

		// Go to anchor if applicable.
		if ( opt["anchor"] && window.location.hash !== "" ) {
			onHashChanged();
		}

		root.data( "venScrollbar", {
			"settings": opt,

			"set": function ( propertyName, value ) {
				if ( $.type( propertyName ) === "string" ) {
					opt[ propertyName ] = value;
				} else {
					$.extend( opt, value );
				}
				return this;
			},

			"refresh": function() {
				readSettings();
				xBar.refresh();
				yBar.refresh();
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
		selectMode: function ( elem, enabled, zeroTolerance ) {
			elem = fn.unbox( elem );
			
			var doNothing = function ( e ) {
				if ( e.preventDefault ) {
					e.preventDefault();
				}
				return false;
			};

			if ( elem.style.MozUserSelect !== undefined ) {
				// Firefox
				elem.style.MozUserSelect = enabled ? "auto" : "none";
			} else {
				// Everyone else
				$( elem )[ enabled ? "off" : "on" ]( "selectstart.venScrollbar", doNothing );
			}

			// Prevent images from being dragged around.
			$( "img", elem )[ enabled ? "off" : "on" ]( "dragstart.venScrollbar", doNothing );
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
						};
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
					.on( "mousemove.venScrollbar-drag", onMouseMove )
					.on( "mouseup.venScrollbar-drag", function() {
						uiRoot.off( ".venScrollbar-drag" );
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
			$( elem ).on( "mousedown.venScrollbar-drag", onMouseDown );

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
			$( data[0] ).off( ".venScrollbar-drag" );

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
			var masterCallback = function () {
				if ( !Sink.hashchange.silentMode ) {
					$.each( data, function ( key, value ) {
						value();
					});
				} else if ( Sink.hashchange.silentMode === 2 ) {
					Sink.hashchange.silentMode = 0;
				}
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
	
	// { 0 -> normal | 1 -> editing | 2 -> ready to update silently }
	Sink.hashchange.silentMode = 0;

	// Update the hash silently.
	Sink.hashchange.silentEdit = function ( id ) {
		// Set silentMode to 1 so that the callbacks are silenced temporarily.
		Sink.hashchange.silentMode = 1;

		// Temporarily remove the id from the target so we can update the
		// hash without having the window scroll.
		var target = $( "#" + id ).attr( "id", "" );
		window.location.hash = "#" + id;
		target.attr( "id", id );

		// Set silentMode to 2 so that the callbacks know they can resume
		// once they receive the updated value.
		Sink.hashchange.silentMode = 2;
	};

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
				$elem.off( "mousemove.venScrollbar-click" );
			},
			
			pause = function() {
				clearTimeout( timeoutID );
				isPaused = true;
			};

		$elem
			.on( "mousedown.venScrollbar-click", function ( e ) {
				$elem.on( "mousemove.venScrollbar-click", function ( e ) {
					event = e;
					if ( isCancelled ) {
						isCancelled = false;
						run();
					}
				});
				event = e;
				run();
			})
			.on( "mouseup.venScrollbar-click", stop )
			.on( "mouseleave.venScrollbar-click", function () {
				if ( isStarted ) {
					pause();
				}
			})
			.on( "mouseenter.venScrollbar-click", function ( e ) {
				if ( isPaused ) {
					event = e;
					run();
				}
			});

		uiRoot.on( "mouseup.venScrollbar-click", stop );

		this[ cookie ] = elem;
		return cookie;

	}, function ( cookie ) {
		if ( elem = this[cookie] ) {
			$( elem ).off( "venScrollbar-click" );
			delete this[cookie];
		}
	});

})( jQuery, window, null );
