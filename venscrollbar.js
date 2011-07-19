/// <reference path="https://ajax.googleapis.com/ajax/libs/jquery/1.6.2/jquery.js" />

(function( $, window, nil, undefined ) {

$.fn["venScrollbar"] = function ( settings, ready ) {
	var defaults = {
		"anchor": true,			// handle anchor link click events
		"autoHide": $.noop,		// { callback | "fade" } for when idle status changes
		"delta": {				// scroll increments in pixels
			"small": 5,
			"medium": 10,
			"large": 15
		},
		"drag": false, 			// use the mouse to drag the body around
		"fixed": false,			// use a fixed bar size
		"idle": 1000,			// milliseconds of inactivity to determine idle status
		"inertial": true, 		// enable inertial scrolling like on iOS devices
		"keyboard": true, 		// enable keyboard navigation support
		"lag": 0,				// delay before responding to scrollbar dragging
		"live": true,			// poll for size changes instead of using refresh()
		"select": true, 		// enable content selection via the mouse
		"smooth": false,		// use animation to make scrolling smooth like in Firefox
		"touch": true,			// enable touch support
		"wheel": true,			// enable mousewheel support
		"wheelLock": false 		// disable mousewheel from scrolling the page
	},

	// Merge two objects recursively, modifying the first.
	set = $.extend( true, defaults, settings );
	
	// IE 8 and 7 don't support mouse events on the window object.
	var uiRoot = $( $.support.changeBubbles ? window : document ),
		
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

				if ( elem.onselectstart !== undefined ) {
					elem.onselectstart = enabled ? nil : function () {
						return false;
					};

				} else if ( elem.style.MozUserSelect !== undefined ) {
					elem.style.MozUserSelect = enabled ? "auto" : "none";

				} else {
					elem.onmousedown = enabled ? nil : function () {
						return false;
					};
				}
			},

			// Returns true if both variables have the same sign.
			sameSign: function ( a, b ) {
				return ( a >= 0 ) ^ ( b < 0 );
			},

			// Returns true if the element has the specified event bound.
			hasEvent: function ( elem, eventType ) {
				var split = eventType.split( "." ),
					events = $.data( fn.unbox(elem), "events" ),

					hasNamespace = function () {
						var ret = false;
						$.each( events[split[0]], function ( key, value ) {
							ret = value[ "namespace" ] === split[1];
							if ( ret ) {
								return false;
							}
						});
						return ret;
					};

				return events ? events[split[0]] ? split[1] ? hasNamespace() : false : false : false;
			}
		},

		// Events.
		sink = (function () {
			var cookieJar = {},
				
				newCookie = function () {
					return ( $.guid++ ).toString();
				},

				ret = {
					mousewheel: {
						hook: function ( elem, callback ) {
							elem = fn.unbox( elem );

							var cookie = newCookie(),
						
								handler = function ( e ) {
									e = e || window.event;

									var event = {
										shiftKey: e.shiftKey,

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

										// Provide an easier interface for preventing the document from scrolling.
										preventDefault: function () {
											// IE9, Chrome, Safari, Firefox, Opera.
											if ( e.preventDefault ) {
												e.preventDefault();
											}

											// IE 8.
											e.cancel = true;
											
											// IE 7.
											e.returnValue = false;
										},

										// Firefox uses e.axis. Webkit uses e.wheelDeltaX.
										axis: e.axis ? e.axis : e.wheelDeltaX ? 1 : 2
									};

									// Invoke the user's event handler, passing the custom event object.
									callback.apply( elem, [event] );
								};
							
							if ( elem.addEventListener ) {
								elem.addEventListener( "mousewheel", handler, false );

								// Firefox.
								elem.addEventListener( "DOMMouseScroll", handler, false );
							} else {
								// IE.
								elem.onmousewheel = handler;
							}

							cookieJar[ cookie ] = {
								"elem": elem,
								"func": handler
							};

							return cookie;
						},

						unhook: function ( cookie ) {
							if ( data = cookieJar[cookie] ) {
								if ( data["elem"].removeEventListener ) {
									data["elem"].removeEventListener( "mousewheel", data["func"], false );
									// Firefox.
									data["elem"].removeEventListener( "DOMMouseScroll", data["func"], false );
								} else {
									// IE.
									data["elem"].onmousewheel = nil;
								}

								delete cookieJar[cookie];
							}
						}
					},

					drag: {
						hook: function ( elem, callback, options ) {
							elem = fn.unbox( elem );

							var cookie = newCookie(),
								coord = nil,
								isNewDrag = true,
								inertial = (function () {
							
									var velocity = { x: 0, y: 0 },
										distance = { x: 0, y: 0 },
										timeStart = { x: 0, y: 0 },
										drag = 0.05,
										amplify = 20,
										frameRef = 0,
										animationID = 0,

										animation = function () {
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

											callback.apply( elem, [event] );
										},

										ret = {
									
											start: function () {
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
												if ( !fn.sameSign( delta["x"], distance.x ) && distance.x !== 0 ) {
													distance.x = 0;
													timeStart.x = time;
												}
												if ( !fn.sameSign( delta["y"], distance.y ) && distance.y !== 0 ) {
													distance.y = 0;
													timeStart.y = time;
												}

												// Update distance.
												distance.x += delta["x"];
												distance.y += delta["y"];
											},

											stop: function () {
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

											clear: function () {
												clearInterval( animationID );
											}

										};

									return ret;

								})(),

								onMouseDown = function () {
									uiRoot.bind( "mousemove.venScrollbar-drag", onMouseMove )
										.bind( "mouseup.venScrollbar-drag", onMouseUp );

									coord = nil;
									isNewDrag = true;
									
									if ( options["inertial"] ) {
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

										if ( options["inertial"] ) {
											inertial.capture( event["delta"] );
										}

										isNewDrag = false;
										
										callback.apply( elem, [event] );
									}

									coord = {
										x: e.pageX,
										y: e.pageY
									};
								},

								onMouseUp = function () {
									uiRoot.unbind( "mousemove.venScrollbar-drag" )
										.unbind( "mouseup.venScrollbar-drag" );
				
									if ( options["inertial"] ) {
										inertial.stop();
									}
								},

								onTouchStart = function () {
									if ( isNewDrag ) {
										coord = nil;
										if ( options["inertial"] ) {
											inertial.start();
										}
									}
								},

								onTouchMove = function ( e ) {
									if ( e.targetTouches.length === 1 ) {
										e.preventDefault();
										onMouseMove({
											pageX: e.targetTouches[0].pageX,
											pageY: e.targetTouches[0].pageY
										});
									}
								},

								onTouchEnd = function ( e ) {
									if ( e.targetTouches.length === 0 ) {
										if ( options["inertial"] ) {
											inertial.stop();
										}
										isNewDrag = true;
									}
								};

							if ( isMobile && options["mobile"] ) {
								// Mobile support.
								elem.ontouchstart = onTouchStart;
								elem.ontouchend = onTouchEnd;
								elem.ontouchmove = onTouchMove;

							} else if ( options["desktop"] ) {
								// Desktop support.
								$( elem ).bind( "mousedown.venScrollbar-drag", onMouseDown );

								// Disable text selection.
								fn.selectMode( elem, false );
							}

							cookieJar[ cookie ] = {
								"elem": elem,
								"stopInertial": inertial.clear
							};

							return cookie;
						},

						unhook: function ( cookie ) {
							if ( data = cookieJar[cookie] ) {
								$( data["elem"] ).unbind( "mousedown.venScrollbar-drag" )
									.unbind( "mousemove.venScrollbar-drag" )
									.unbind( "mouseup.venScrollbar-drag" );

								// Enable text selection.
								fn.selectMode( data["elem"], true );

								delete cookieJar[cookie];
							}
						},

						stopInertial: function (cookie) {
							if ( data = cookieJar[cookie] ) {
								data[ "stopInertial" ]();
							}
						}
					},

					// We use polling to detect when a property changes.
					propertychanged: {
						hook: function ( elem, comparer, callback, args ) {
							elem = fn.unbox( elem );
							var cookie = newCookie();

							cookieJar[ cookie ] = {
								"poll": setInterval( function () {
									var e = comparer( cookie, args );
									if ( e ) {
										callback.apply( elem, [e] );
									}
								}, 50),

								"elem": $( elem )
							};

							return cookie;
						},

						unhook: function ( cookie ) {
							if ( data = cookieJar[cookie] ) {
								clearInterval( data["poll"] );
								delete cookieJar[cookie];
							}
						},

						// The comparers return an event object. If they don't return an object,
						// then the event is not fired.
						comparers: {
							size: function ( cookie ) {
								var $elem = cookieJar[ cookie ]["elem"],
									oldWidth = cookieJar[ cookie ]["w"],
									oldHeight = cookieJar[ cookie ]["h"],
									newWidth = $elem.outerWidth(),
									newHeight = $elem.outerHeight(),
									e = nil;

								if ( oldWidth !== undefined ) {
									if ( oldHeight !== newHeight || oldWidth !== newWidth ) {
										e = true;
									}
								}

								cookieJar[ cookie ]["h"] = newHeight;
								cookieJar[ cookie ]["w"] = newWidth;
						
								return e;
							},

							jQueryProperty: function ( cookie, property ) {
								var $elem = cookieJar[ cookie ]["elem"],
									oldValue = cookieJar[ cookie ]["val"],
									newValue = $elem[ property ](),
									e = nil;

								if ( oldValue !== undefined && oldValue !== newValue ) {
									e = true;
								}
								cookieJar[ cookie ]["val"] = newValue;
								return e;
							},

							hash: function ( cookie ) {
								var e = nil,
									hash = window.location.hash;

								if ( cookieJar[ cookie ]["val"] !== undefined && hash !== cookieJar[ cookie ]["val"] ) {
									e = { hash: hash };
								}

								cookieJar[ cookie ]['val'] = hash;

								return e;
							}
						}
					}
				};

			return ret;
		})();


	return this.each(function () {
		var valid = ["auto", "scroll"],
			body = $( this ),
			root,
			opt = $.extend(true, $.extend( true, { }, set ), {
				"overflow": {
					"x": body.css( "overflow-x" ),
					"y": body.css( "overflow-y" )
				}
			});

		// Skip elements that do not have overflow set to auto or scroll.
		if ( $.inArray( opt["overflow"]["x"], valid ) === -1 && $.inArray( opt["overflow"]["y"], valid ) === -1 ) {
			return;
		}

		// HTML injection.
		(function () {
			// Create wrapper element.
			root = $( "<div class='venscrollbar'>" );

			// If an ID exists, relocate it.
			if ( body.attr( "id" ) !== undefined ) {
				root.attr( "id", body.attr( "id" ) );
			}

			// CSS properties that affect layout.
			var cssProp = [
					"height", "min-height", "max-height", "width", "min-width", "max-width",
					"margin", "border", "outline", "display", "position", "float", "clear",
					"visibility", "top", "right", "bottom", "left", "z-index", "overflow", "clip"
				],

				// Note, non-standard defaults: { display: block, position: absolute }.
				cssDefs = [
					"auto", "0", "none", "auto", "0", "none", "0", "none", "none", "block", "absolute",
					"none", "none", "visible", "auto", "auto", "auto", "auto", "auto", "visible", "auto"
				];

			// Move box and layout properties to wrapper element.
			$.each( cssProp, function ( i ) {
				root.css( cssProp[i], body.css( cssProp[i] ) );
				body.css( cssProp[i], cssDefs[i] );
			});
			
			// Wrapper element needs to have a position other than static.
			if ( root.css( "position" ) !== "absolute" ) {
				root.css( "position", "relative" );
			}
			
			// The ID needs to be removed after the styles have been copied.
			body.removeAttr( "id" ).addClass( "venscrollbar-body" );

			// Append each container element to the wrapper.
			var html = $.map( ["window", "ui", "ui-track-x", "ui-track-y", "ui-bar-x", "ui-bar-y"], function ( value, key ) {
				return "<div class='venscrollbar-" + value + "'/>";
			});
			var ui = html.splice( 2, 8 );
			root.append( html.join( "" ) );
			root.children( ".venscrollbar-ui" ).append( ui.join( "" ) );

			// Add wrapper to the DOM and relocate the body.
			body.parent().append( root );
			body.detach();
			root.children( ".venscrollbar-window" ).append( body );
		})();

		// Cache commonly used selectors.
		var	viewport = $( "> .venscrollbar-window", root ),
			controls = $( "> .venscrollbar-ui", root ),

			wake = (function() {
				var isIdle = true,
					timeoutID = 0,

					set_isIdle = function ( value ) {
						if ( !value ) {
							clearTimeout( timeoutID );
							timeoutID = setTimeout( function () {
								set_isIdle( true );
							}, opt["idle"] );
						}

						if ( isIdle !== value ) {
							isIdle = value;
							if ( opt["autoHide"] === "fade" ) {
								if ( isIdle ) {
									controls.fadeOut();
								} else {
									controls.fadeIn();
								}

							} else {
								opt["autoHide"]( isIdle );
							}
						}
					};

				return function () {
					set_isIdle( false );
				};
			})(),

			// Stops any inertial scrolling that may be going on.
			stopInertial = $.noop,
			
			/**
			 * @constructor
			 */
			ScrollBar = function ( axis ) {
				var me = this,
					overflow = "",
					bar = $( "> .venscrollbar-ui-bar-" + (axis === 1 ? "x" : "y"), controls ),
					track = $( "> .venscrollbar-ui-track-" + (axis === 1 ? "x" : "y"), controls ),

					cookieJar = {
						live: {
							viewport: nil,
							body: nil,
							track: nil,
							bar: nil
						},
						drag: nil
					},
					value = 0,

					// The maxium value of the scrollbar.
					limit = 0,
					
					// Actual position of the scrollbar. If SMOOTH is true, then the
					// position may differ from the value. LATENCY may also affect the
					// position.
					position = 0,
					set_position = function ( val ) {
						position = val;

						var prop = axis === 1 ? "left" : "top",
							offset = (val / me.ratio * -1) + body.offsetParent().offset()[prop];

						// Update the position of the scrollbar element.
						bar.css( prop, val );
						
						// Update the position of the body. Multiply by -1 because the body needs to go in
						// the opposite direction than the scrollbar.
						// We need to use the .offset() function because weird things happen when the page
						// loads with a hash in the URL, and there is a corresponding anchor point in our
						// body element.
						body.offset({
							top: axis !== 1 ? offset : body.offset()["top"],
							left: axis === 1 ? offset : body.offset()["left"]
						});
					},

					isEnabled = false,
					set_isEnabled = function ( val ) {
						if ( isEnabled !== val ) {
							isEnabled = val;
							updateStyle();
							bar[ isEnabled ? "addClass" : "removeClass" ]( "ven-state-disabled" );
							return true;
						} else {
							return false;
						}
					},

					// Scrollbar { height | width } depending on axis.
					size = 0,
					set_size = function ( val ) {
						if ( size !== val ) {
							size = val;
							bar[ axis === 1 ? "width" : "height" ]( size );
							return true;
						} else {
							return false;
						}
					},
				
					updateStyle = function () {
						// If overflow is set to auto and scrollbar is disabled, or if
						// overflow is set to hidden, then hide.
						bar.css( "display", overflow === "auto" && !isEnabled || overflow === "hidden" ? "none" : "block" );
					},

					onSizeChanged = function () {
						var outer = axis === 1 ? "outerWidth" : "outerHeight",
							inner = axis === 1 ? "innerWidth" : "innerHeight";

						// If the track size is set to 0, then use the viewport size.
						var tSize = track[ outer ]();
						tSize = tSize !== 0 ? tSize : viewport[ inner ]();

						// If the scrollbar is a fixed size, then we need to set the
						// size of the bar and track, and then determine the ratio.
						// If not, we need to determine the ratio, and then set the
						// size of the bar and track.
						if ( opt["fixed"] ) {
							set_size( bar[outer] );
							limit = tSize - size;
							me.ratio = limit / ( body[ outer ]() - viewport[ inner ]() );

						} else {
							me.ratio = tSize / body[ outer ]();
							if ( me.ratio < 1 ) {
								set_size( me.ratio * viewport[ inner ]() );
							}
							limit = tSize - size;
						}
						
						// Update isEnabled.
						set_isEnabled( body[ outer ]() > viewport[ inner ]() );
					},

					onDrag = (function () {
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

							if ( me.val( value + delta, true ) || e["isNewDrag"] ) {
								mouseLastOK = mousePosition;
							}
						};
					})(),

					slide = (function () {
						var rounds = 0,
							intervalID = 0,

							start = function () {
								intervalID = setInterval( function () {
									if ( rounds === 0 ) {
										clearInterval( intervalID );
										intervalID = 0;
										return;
									}
									set_position( Math.round( position + (value - position) / rounds ) );
									rounds--;
								}, $.fx.interval );
							},

							reset = function ( duration ) {
								// If there's no where to go, then don't do anyting.
								if ( position !== value ) {
									rounds = Math.round( duration / $.fx.interval );

									// If the loop isn't already running, start it.
									if ( intervalID === 0 ) {
										start();
									}
								}
							};

						return reset;
					})(),

					readSettings = function () {
						// Update overflow field and style if necessary.
						var tmp = axis === 1 ? opt[ "overflow" ]["x"] : opt[ "overflow" ]["y"];
						if ( overflow !== tmp ) {
							overflow = tmp;
							updateStyle();
						}
					
						// Live support.
						if ( opt["live"] ) {
							if ( cookieJar.live.viewport === nil ) {
								var outer = axis === 1 ? "outerWidth" : "outerHeight",
									inner = axis === 1 ? "innerWidth" : "innerHeight";

								cookieJar.live.viewport = sink.propertychanged.hook( viewport, sink.propertychanged.comparers.jQueryProperty, onSizeChanged, inner );
								cookieJar.live.body = sink.propertychanged.hook( body, sink.propertychanged.comparers.jQueryProperty, onSizeChanged, outer );
								cookieJar.live.track = sink.propertychanged.hook( track, sink.propertychanged.comparers.jQueryProperty, onSizeChanged, outer );

								if ( opt["fixed"] ) {
									if ( cookieJar.live.bar === nil ) {
										cookieJar.live.bar = sink.propertychanged.hook( bar, sink.propertychanged.comparers.jQueryProperty, onSizeChanged, outer );
									}
								} else {
									sink.propertychanged.unhook( cookieJar.live.bar );
									cookieJar.live.bar = nil;
								}
							}

						} else {
							$.each( cookieJar.live, function ( key, cookie ) {
								sink.propertychanged.unhook( cookie );
								cookieJar.live[key] = nil;
							});
						}

						// Touch and drag support.
						sink.drag.unhook( cookieJar.drag );
						if ( opt["drag"] || opt["touch"] ) {
							cookieJar.drag = sink.drag.hook( bar, onDrag, {
								"mobile": opt["touch"],
								"desktop": true
							});
						}
					},
				
					ctor = function () {
						// Set default styles.
						if ( bar.css( "position" ) === "static" ) {
							var param = { "position": "absolute" };
							param[ axis === 1 ? "left" : "right" ] = "0";
							param[ axis === 1 ? "bottom" : "top" ] = "0";
							bar.css( param );
						}
						if ( axis === 1 && bar.outerHeight() === 0 ) {
							bar.css( "height", "10px" );
						}
						if ( axis === 2 && bar.outerWidth() === 0 ) {
							bar.css( "width", "10px" );
						}

						// If effectively invisible, make it visible.
						if ( bar.css( "background" ) === "" && bar.css( "border" ) === "" && bar.children().length === 0 ) {
							bar.css({
								"background": "black",
								"opacity": "0.5"
							});
						}

						me.refresh();
					};

				me.refresh = function () {
					onSizeChanged();
					readSettings();
				};

				// When FIXED is true, ratio is limit / (body size - viewport size).
				// When FIXED is false, ratio is track size / body size.
				me.ratio = 1,

				// The { top | left } position of scrollbar depending on axis.
				// Returns true if value was changed.
				me.val = function ( val, dragging ) {
					// We only care about position if the scrollbar is enabled.
					if ( val === undefined || !isEnabled ) {
						return value;
					}

					// Position cannot go outside of the limit.
					val = val < 0 ? 0 : val > limit ? limit : val;

					if ( value !== val ) {
						value = val;

						// When normal is true, we bypass whatever SMOOTH is set to.
						if ( !opt["smooth"] || dragging ) {
							// Check for values smaller than 0 because this LAG is a user-inputted value.
							if ( !dragging || opt["lag"] <= 0 ) {
								set_position( val );
						
							} else {
								// Implement lag.
								setTimeout( function () {
									slide( 130 );
								}, opt["lag"] );
							}

						} else {
							// Implement smooth scrolling.
							slide( 130 );
						}
						return true;

					} else {
						return false;
					}
				};

				// Returns true if value was changed.
				me.end = function () {
					return me.val( limit, false );
				};

				ctor();
			};


		// Initialize plugin and store the resulting API object using the jQuery data method.
		root.data( "venScrollbar", (function () {
			var xBar,
				yBar,
				cookieJar = {
					touch: nil,
					wheel: nil,
					anchor: nil
				},
				anchors = $(),
				
				onScroll = function ( e ) {
					stopInertial();

					// Wake from idle.
					wake();

					var ui = e.shiftKey || e.axis === 1 ? xBar : yBar,
						hasChanged = ui.val( ui.val() + opt["delta"]["medium"] * (e.wheelDelta < 0 ? 1 : -1) );

					if ( opt["wheelLock"] || hasChanged ) {
						e.preventDefault();
					}
				},

				onDrag = function ( e ) {
					// Wake from idle.
					wake();

					xBar.val( xBar.val() + e["delta"]["x"] * -xBar.ratio );
					yBar.val( yBar.val() + e["delta"]["y"] * -yBar.ratio );
				},

				onKeyDown = function ( e ) {
					if ( e.keyCode > 31 && e.keyCode < 41 ) {
						stopInertial();

						// Wake from idle.
						wake();
					}

					var hasChanged = false;

					switch ( e.keyCode ) {
						case 32: // spacebar
							hasChanged = yBar.val( yBar.val() + opt["delta"]["large"] * ( e.shiftKey ? -1 : 1 ) );
							break;
						case 33: // pageup
							hasChanged = yBar.val( yBar.val() - opt["delta"]["large"] );
							break;
						case 34: // pagedown
							hasChanged = yBar.val( yBar.val() + opt["delta"]["large"] );
							break;
						case 35: // end
							hasChanged = yBar.end();
							break;
						case 36: // home
							hasChanged = yBar.val( 0 );
							break;
						case 37: // left
							hasChanged = xBar.val( xBar.val() - opt["delta"]["small"] );
							break;
						case 38: // up
							hasChanged = yBar.val( yBar.val() - opt["delta"]["small"] );
							break;
						case 39: // right
							hasChanged = xBar.val( xBar.val() + opt["delta"]["small"] );
							break;
						case 40: // down
							hasChanged = yBar.val( yBar.val() + opt["delta"]["small"] );
							break;
						default:
							return;
					}

					if ( opt["wheelLock"] || hasChanged ) {
						e.preventDefault();
					}
				},

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
				
				onHashChanged = function ( e ) {
					var validElems = anchors.filter( "a[href='" + e["hash"] + "']" );
					if ( validElems.length > 0 ) {
						onAnchorClicked.apply( validElems[0], [$.Event()] );
					}
				},

				onSelectionStart = function ( e ) {
					var intervalID = 0,
						xStep = 0,
						yStep = 0,
						elem = $( this );

					uiRoot.bind( "mousemove.venScrollbar-select", function ( e ) {
						var offset = elem.offset(),
							limit = {
								top: offset["top"],
								left: offset["left"],
								bottom: offset["top"] + elem.height(),
								right: offset["left"] + elem.width()
							};

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

					}).bind( "mouseup.venScrollbar-select", function () {
						clearInterval( intervalID );
						uiRoot.unbind( "mousemove.venScrollbar-select" )
							.unbind( "mouseup.venScrollbar-select" );
					});
				},
				
				readSettings = function () {
					// Mousewheel support.
					if ( opt["wheel"] ) {
						if ( cookieJar.wheel === nil ) {
							cookieJar.wheel = sink.mousewheel.hook( root, onScroll );
						}
					} else {
						sink.mousewheel.unhook( cookieJar.wheel );
						cookieJar.wheel = nil;
					}

					// Touch and drag support.
					sink.drag.unhook( cookieJar.touch );
					if ( opt["drag"] || opt["touch"] ) {
						cookieJar.touch = sink.drag.hook( body, onDrag, {
							"mobile": opt["touch"],
							"desktop": opt["drag"],
							"inertial": opt["inertial"]
						});

						// Set plugin instance function.
						stopInertial = function () {
							sink.drag.stopInertial( cookieJar.touch );
						};
					}
			
					// Keyboard support.
					if ( opt["keyboard"] ) {
						if ( !fn.hasEvent( root, "keydown.venScrollbar" ) ) {
							root[0].tabIndex = 0;
							root.bind( "keydown.venScrollbar", onKeyDown );
						}
					} else {
						root.unbind( "keydown.venScrollbar" );
					}

					// Anchor support.
					if ( opt["anchor"] ) {
						if ( cookieJar.anchor === nil ) {
							anchors = body.find( "[id]" )
								.map(function () {
									var hash = "#" + $( this ).attr( "id" ),
										anchor = $( "a[href='" + hash + "']" );
									
									return anchor.length > 0 ? anchor[0] : nil;
								}).bind( "click.venScrollbar", onAnchorClicked );

							cookieJar.anchor = sink.propertychanged.hook( window, sink.propertychanged.comparers.hash, onHashChanged );
						}

					} else {
						anchors.unbind( "click.venScrollbar" );
						sink.propertychanged.unhook( cookieJar.anchor );
						cookieJar.anchor = nil;
					}

					// Selection support only if DRAG is false and we are not on a mobile device.
					if ( opt["select"] && !opt["drag"] && !isMobile ) {
						if ( !fn.hasEvent( viewport, "mousedown.venScrollbar" ) ) {
							viewport.bind( "mousedown.venScrollbar-select", onSelectionStart );
						}
					} else {
						fn.selectMode( body, false );
						viewport.unbind( "mousedown.venScrollbar-select" );
					}
				};


			// Set default styles.
			body.css( "position", "absolute" );
			viewport.css({
				"overflow": "hidden",
				"position": "absolute"
			});
			if ( viewport.innerHeight() === 0 ) {
				viewport.css( "height", "100%" );
			}
			if ( viewport.innerWidth() === 0 ) {
				viewport.css( "width", "100%" );
			}

			// Initialize scrollbars.
			xBar = new ScrollBar( 1 );
			yBar = new ScrollBar( 2 );

			// Although it'd be cool to use the CSS property and poll it for changes,
			// we'd limit ourselves in what we can do design-wise because everything
			// would have to be contained within the root element. We could be more
			// flexible if we used a regular variable and set overflow to visible.
			root.css( "overflow", "visible" );

			readSettings();

			// Go to anchor if applicable.
			if ( opt["anchor"] && window.location.hash !== "" ) {
				onHashChanged({ "hash": window.location.hash });
			}

			return {
				"settings": opt,

				"refresh": function () {
					xBar.refresh();
					yBar.refresh();
					readSettings();
				},

				"scroll": function ( axis, distance ) {
					var ui = axis === 1 ? xBar : yBar;
					ui.val( ui.val() + distance );
				}
			};
		})());

		var func = ready ? ready : settings;
		if ( $.isFunction( func ) ) {
			func.apply( fn.unbox(root), [root.data( "venScrollbar" )] );
		}

	});
	
};

})( jQuery, window, null );
