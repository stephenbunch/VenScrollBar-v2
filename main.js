/// <reference path="https://ajax.googleapis.com/ajax/libs/jquery/1.6.1/jquery.js" />

$.fn.VenScrollBar = function (opt) {
	var def = {
		anchor: true,				// handle anchor link click events								[done]
		arrows: true,				// inject html for arrows
		autoHide: false, 			// hide scrollbar after a certain period of inactivity
		class: {					//																[done]
			viewport: "viewport",	// visible part of the content
			xtrack: "xtrack",		// horizontal track
			ytrack: "ytrack",		// vertical track
			xbar: "xbar",			// horizontal bar
			ybar: "ybar",			// vertical bar
			up: "up",				// up arrow
			down: "down",			// down arow
			left: "left",			// left arrow
			right: "right",			// right arrow
			root: "venscrollbar",	// root element
			content: "content",		// original element in jQuery selector
			disabled: "disabled",	// a class for when the scrollbar is disabled
			active: "active"		// an alternative to the buggy :active pseudo selector
		},
		delta: {					// scroll increments in pixels									[done]
			small: 5,
			medium: 10,
			large: 15
		},
		fixed: false,				// use a fixed bar size											[done]
		grab: false, 				// use the hand tool to move content around						[done]
		html: {						// custom html to inject into root elements
			ybar: "",
			xbar: "",
			ytrack: "",
			xtrack: "",
			up: "",
			down: "",
			left: "",
			right: "",
			view: ""
		},
		inertial: true, 			// enable inertial scrolling like on iOS devices				[done]
		keyboard: true, 			// enable keyboard navigation support							[done]
		lag: 0,						// delay before responding to scrollbar dragging				[done]
		live: true,					// poll for size changes instead of using refresh()				[done]
		select: true, 				// enable content selection via the mouse						[done]
		smooth: false,				// use animation to make scrolling smooth like in Firefox		[done]
		touch: true,				// enable touch support											[done]
		wheel: true,				// enable mousewheel support									[done]
		wheelLock: false 			// disable mousewheel from scrolling the page					[done]
	};

	// Merge two objects recursively, modifying the first.
	opt = $.extend(true, def, opt);

	// IE 8 and 7 don't support mouse events on the window object.
	var rootElem = $($.support.changeBubbles ? window : document),
		
		// Miscellaneous functions	
		fn = {
			setSelection: function (elem, enabled) {
				if (elem instanceof $) {
					elem = elem[0];
				}
				if (elem.onselectstart !== undefined) {
					elem.onselectstart = enabled ? null : function() {
						return false;
					};
				} else if (elem.style.MozUserSelect !== undefined) {
					elem.style.MozUserSelect = enabled ? "all" : "none";
				} else {
					elem.onmousedown = enabled ? null : function() {
						return false;
					};
				}
			},

			sameSign: function (a, b) {
				return (a >= 0) ^ (b < 0);
			},

			setInterval: function (callback, delay, executeNow) {
				if (executeNow) {
					callback();
				}
				return setInterval(callback, delay);
			}
		},

		// Events
		sink = (function () {
			var cookieJar = {},
			
				unbox = function (elem) {
					return elem instanceof $ ? elem[0] : elem;
				},

				newCookie = function () {
					return ($.guid++).toString();
				},

				ret = {
					mousewheel: {
						bind: function (elem, callback, data) {
							elem = unbox(elem);

							var cookie = newCookie(),
						
								handler = function (e) {
									e = e || window.event;

									var event = {
										originalEvent: e,

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
											if (e.stopPropagation) {
												e.stopPropagation();
											}
											if (e.preventDefault) {
												e.preventDefault();
											}
											e.cancelBubble = true;
											e.cancel = true;
											e.returnValue = false;
										},

										// Firefox uses e.axis. Webkit uses e.wheelDeltaX.
										axis: e.axis ? e.axis : e.wheelDeltaX ? 1 : 2,

										data: data
									};

									// Invoke the user's event handler, passing the custom event object.
									callback.apply(elem, [event]);
								};
					
							if (elem.addEventListener) {
								elem.addEventListener("mousewheel", handler, false);
								elem.addEventListener("DOMMouseScroll", handler, false); // For Firefox.

							} else {
								elem.onmousewheel = handler; // For IE.
							}

							cookieJar[cookie] = {
								elem: elem,
								handler: handler
							};

							return cookie;
						},

						unbind: function (cookie) {
							var elem = cookieJar[cookie].elem,
								handler = cookieJar[cookie].handler;

							if (elem.removeEventListener) {
								elem.removeEventListener("mousewheel", handler, false);
								elem.removeEventListener("DOMMouseScroll", handler, false); // For Firefox.

							} else {
								elem.onmousewheel = null; // For IE.
							}

							delete cookieJar[cookie];
						}
					},

					drag: {
						bind: function (elem, callback, data) {
							elem = unbox(elem);

							var cookie = newCookie(),
								coord = null,
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
											var x = Math.pow(2, -(drag * frameRef)) * velocity.x,
												y = Math.pow(2, -(drag * frameRef)) * velocity.y;

											if (Math.round(x, 6) === 0 && Math.round(y, 6) === 0 || coord === null) {
												// Stop the animation and exit.
												clearInterval(animationID);
												return;
											}

											var event = {
												delta: {
													x: x < 0 ? Math.ceil(x) : Math.floor(x),
													y: y < 0 ? Math.ceil(y) : Math.floor(y)
												},
												pageY: coord.y,
												pageX: coord.x,
												isNewDrag: false,
												data: data
											};

											callback.apply(elem, [event]);
										},

										ret = {
									
											start: function () {
												// Stop the animation.
												clearInterval(animationID);

												distance = { x: 0, y: 0 };
												var time = $.now();
												timeStart = {
													x: time,
													y: time
												};
											},

											capture: function (delta) {
												// Reset if direction changes.
												var time = $.now();
												if (!fn.sameSign(delta.x, distance.x) && distance.x !== 0) {
													distance.x = 0;
													timeStart.x = time;
												}
												if (!fn.sameSign(delta.y, distance.y) && distance.y !== 0) {
													distance.y = 0;
													timeStart.y = time;
												}

												// Update distance.
												distance.x += delta.x;
												distance.y += delta.y;
											},

											stop: function () {
												var now = $.now();

												velocity.x = Math.pow(Math.abs(distance.x / (now - timeStart.x)), 2.3) * amplify;
												velocity.y = Math.pow(Math.abs(distance.y / (now - timeStart.y)), 2.3) * amplify;

												if (!fn.sameSign(velocity.x, distance.x)) {
													velocity.x *= -1;
												}
												if (!fn.sameSign(velocity.y, distance.y)) {
													velocity.y *= -1;
												}

												// Start the animation.
												frameRef = 0;
												animationID = setInterval(animation, $.fx.interval);
											},

											clear: function () {
												clearInterval(animationID);
											}

										};

									return ret;

								})(),

								onMouseDown = function (e) {
									rootElem.bind("mousemove.drag", onMouseMove).bind("mouseup.drag", onMouseUp);

									coord = null;
									isNewDrag = true;
							
									if (data.inertial) {
										inertial.start();
									}
								},

								onMouseMove = function (e) {
									if (coord !== null) {
										var event = {
											delta: {
												x: Math.floor(e.pageX - coord.x),
												y: Math.floor(e.pageY - coord.y)
											},
											pageY: e.pageY,
											pageX: e.pageX,
											isNewDrag: isNewDrag,
											data: data
										};

										if (data.inertial) {
											inertial.capture(event.delta);
										}

										isNewDrag = false;
										
										callback.apply(elem, [event]);
									}

									coord = {
										x: e.pageX,
										y: e.pageY
									};
								},

								onMouseUp = function (e) {
									rootElem.unbind("mousemove.drag").unbind("mouseup.drag");
				
									if (data.inertial) {
										inertial.stop();
									}
								},

								onTouchStart = function (e) {
									if (isNewDrag) {
										coord = null;
										if (data.inertial) {
											inertial.start();
										}
									}
								},

								onTouchMove = function (e) {
									if (e.targetTouches.length == 1) {
										e.preventDefault();
										onMouseMove({
											pageX: e.targetTouches[0].pageX,
											pageY: e.targetTouches[0].pageY
										});
									}
								},

								onTouchEnd = function (e) {
									if (e.targetTouches.length === 0) {
										if (data.inertial) {
											inertial.stop();
										}
										isNewDrag = true;
									}
								};

							if (elem.ontouchstart !== undefined && data.mobile) {
								// Mobile support.
								elem.ontouchstart = onTouchStart;
								elem.ontouchend = onTouchEnd;
								elem.ontouchmove = onTouchMove;

							} else if (data.desktop) {
								// Desktop support.
								$(elem).bind("mousedown.drag", onMouseDown);

								// Disable text selection.
								fn.setSelection(elem, false);
							}

							cookieJar[cookie] = {
								elem: elem,
								stopInertial: inertial.clear
							};

							return cookie;
						},

						unbind: function (cookie) {
							var elem = cookieJar[cookie];
							$(elem).unbind("mousedown.drag").unbind("mousemove.drag").unbind("mouseup.drag");

							// Enable text selection.
							fn.setSelection(elem, true);

							delete cookieJar[cookie];
						},

						stopInertial: function (cookie) {
							cookieJar[cookie].stopInertial();
						}
					},

					// We use polling to detect when a property changes.
					propertychanged: {
						bind: function (elem, comparer, callback, options, data) {
							elem = unbox(elem);
							var cookie = newCookie();

							cookieJar[cookie] = {
								poll: setInterval(function () {
									var e = comparer(cookie, options);
									if (e) {
										e.data = data;
										callback.apply(elem, [e]);
									}
								}, 50),

								elem: $(elem)
							};

							return cookie;
						},

						unbind: function (cookie) {
							clearInterval(cookieJar[cookie].poll);
							delete cookieJar[cookie];
						},

						// The comparers return an event object. If they don't return an object,
						// then the event is not fired.
						comparers: {
							size: function (cookie) {
								var $elem = cookieJar[cookie].elem,
									oldWidth = cookieJar[cookie].w,
									oldHeight = cookieJar[cookie].h,
									newWidth = $elem.outerWidth(),
									newHeight = $elem.outerHeight(),
									e = null;

								if (oldWidth !== undefined) {
									if (oldHeight !== newHeight || oldWidth !== newWidth) {
										e = {
											oldSize: {
												width: oldWidth,
												height: oldHeight
											},
											newSize: {
												width: newWidth,
												height: newHeight
											}
										};
									}
								}

								cookieJar[cookie].h = newHeight;
								cookieJar[cookie].w = newWidth;
						
								return e;
							},

							jQueryProperty: function (cookie, property) {
								var $elem = cookieJar[cookie].elem,
									oldValue = cookieJar[cookie].value,
									newValue = $elem[property](),
									e = null;

								if (oldValue !== undefined && oldValue !== newValue) {
									e = {
										oldValue: oldValue,
										newValue: newValue
									};
								}
								cookieJar[cookie].value = newValue;
								return e;
							},

							overflow: function (cookie) {
								var e = null,
									$elem = cookieJar[cookie].elem,
									newX = $elem.css("overflow-x"),
									newY = $elem.css("overflow-y");

								if (cookieJar[cookie].xValue !== undefined) {
									if (newX !== cookieJar[cookie].x || newY !== cookieJar[cookie].y) {
										e = {
											x: newX,
											y: newY
										};
									}
								}

								cookieJar[cookie].x = newX;
								cookieJar[cookie].y = newY;

								return e;
							},

							hash: function (cookie) {
								var e = null,
									hash = window.location.hash;

								if (cookieJar[cookie].value !== undefined) {
									if (hash !== cookieJar[cookie].value) {
										e = { hash: hash };
									}
								}

								cookieJar[cookie].value = hash;

								return e;
							}
						}
					}
				};

			return ret;
		})(),

		ScrollBar = function (bar, track, viewport, body, axis, cssOverflow) {
			var me = this,
				size = 0,
				state = 0,
				value = 0,
				overflow = cssOverflow,
				
				setPosition = function (val) {
					me.position = val;

					// Update the position of the scrollbar element.
					bar.css(me.axis === 1 ? "left" : "top", val);
					
					// Update the position of the body. Multiply by -1 because the
					// body needs to go in the opposite direction than the scrollbar.
					body.css(me.axis === 1 ? "left" : "top", val / me.ratio * -1);
				},
				
				updateStyle = function () {
					// If overflow is set to auto and state is disabled, or if
					// overflow is set to hidden, then hide.
					bar.css("display", overflow === "auto" && state === 0 || overflow === "hidden" ? "none" : "block");
				},

				onSizeChanged = function () {
					var outer = me.axis === 1 ? "outerWidth" : "outerHeight",
						inner = me.axis === 1 ? "innerWidth" : "innerHeight";

					// If the scrollbar is a fixed size, then we need to set the
					// size of the bar and track, and then determine the ratio.
					// If not, we need to determine the ratio, and then set the
					// size of the bar and track.
					if (opt.fixed) {
						me.size(bar[outer]);
						me.limit = track[outer]() - size;
						me.ratio = me.limit / (body[outer]() - viewport[inner]());

					} else {
						me.ratio = track[outer]() / body[outer]();
						if (me.ratio < 1) {
							me.size(me.ratio * viewport[inner]());
						}
						me.limit = track[outer]() - me.size();
					}

					// Update the state.
					me.state(body[outer]() > viewport[inner]());
				},

				mouseLastOK = 0,
				onDrag = function (e) {
					me.stopInertial();

					var mousePosition = me.axis === 1 ? e.pageX : e.pageY,
						delta = me.axis === 1 ? e.delta.x : e.delta.y;

					// Prevent the mouse from dragging the scrollbar when its position is not
					// the same as when it first clicked on the scrollbar.
					if (!e.isNewDrag) {
						if (delta < 0 && mousePosition >= mouseLastOK || delta > 0 && mousePosition <= mouseLastOK) {
							return;
						}
					}

					if (me.val(value + delta, true) || e.isNewDrag) {
						mouseLastOK = mousePosition;
					}
				},

				motion = (function () {
					var rounds = 0,
						intervalID = 0,

						start = function () {
							intervalID = setInterval(function () {
								if (rounds === 0) {
									clearInterval(intervalID);
									intervalID = 0;
									return;
								}
								setPosition(Math.round(me.position + (value - me.position) / rounds));
								rounds--;
							}, $.fx.interval);
						},

						reset = function (duration) {
							// If there's no where to go, then don't do anyting.
							if (me.position !== value) {
								rounds = Math.round(duration / $.fx.interval);

								// If the loop isn't already running, start it.
								if (intervalID === 0) {
									start();
								}
							}
						};

					return { reset: reset };
				})(),
				
				ctor = function () {
					onSizeChanged();

					// Set default styles.
					if (bar.css("position") === "static") {
						var param = { "position": "absolute" };
						param[me.axis === 1 ? "left" : "right"] = "0";
						param[me.axis === 1 ? "bottom" : "top"] = "0";
						bar.css(param);
					}
					
					// Live support.
					if (opt.live) {
						var outer = me.axis === 1 ? "outerWidth" : "outerHeight",
							inner = me.axis === 1 ? "innerWidth" : "innerHeight";

						sink.propertychanged.bind(viewport, sink.propertychanged.comparers.jQueryProperty, onSizeChanged, inner);
						sink.propertychanged.bind(body, sink.propertychanged.comparers.jQueryProperty, onSizeChanged, outer);
						sink.propertychanged.bind(track, sink.propertychanged.comparers.jQueryProperty, onSizeChanged, outer);

						if (opt.fixed) {
							sink.propertychanged.bind(bar, sink.propertychanged.comparers.jQueryProperty, onSizeChanged, outer);
						}
					}

					// Touch and grab support.
					if (opt.grab || opt.touch) {
						sink.drag.bind(bar, onDrag, { mobile: opt.touch, desktop: true });
					}
				};

			// Set outside this class, inside the plugin initialization.
			// Stops any inertial scrolling that may be going on.
			me.stopInertial = $.noop;

			// Scrollbar axis: { 1 -> x | 2 -> y }.
			me.axis = axis;

			// CSS overflow value.
			me.overflow = function (val) {
				if (val === undefined) {
					return overflow;
				}
				if (overflow !== val) {
					overflow = val;
					updateStyle();
					return true;
				} else {
					return false;
				}
			};

			// The maxium value of the scrollbar.
			me.limit = 0;

			// When FIXED is true, ratio is limit / (body size - viewport size).
			// When FIXED is false, ratio is track size / body size.
			me.ratio = 1;

			// Actual position of the scrollbar. If SMOOTH is true, then the
			// position may differ from the value. LATENCY may also affect the
			// position.
			me.position = 0;

			// Scrollbar state: { 0 -> disabled | 1 -> enabled }.
			me.state = function (val) {
				if (val === undefined) {
					return state;
				}
				if (state !== val) {
					state = val;
					updateStyle();
					bar[state === 1 ? "addClass" : "removeClass"](opt.class.disabled);
					return true;
				} else {
					return false;
				}
			};

			// Scrollbar { height | width } depending on axis.
			me.size = function (val) {
				if (val === undefined) {
					return size;
				}
				if (size !== val) {
					size = val;
					bar[me.axis === 1 ? "width" : "height"](size);
					return true;
				} else {
					return false;
				}
			};

			// The { top | left } position of scrollbar depending on axis.
			// Returns true if a change was made.
			me.val = function (val, dragging) {
				// We only care about position if the scrollbar is enabled.
				if (val === undefined || state === 0) {
					return value;
				}

				// Position cannot go outside of the limit.
				val = val < 0 ? 0 : val > me.limit ? me.limit : val;

				if (value !== val) {
					value = val;

					// When normal is true, we bypass whatever SMOOTH is set to.
					if (!opt.smooth || dragging) {
						// Check for values smaller than 0 because this opt.lag is a user-inputted value.
						if (!dragging || opt.lag <= 0) {
							setPosition(val);
						
						} else {
							// Implement lag.
							setTimeout(function () {
								motion.reset(130);
							}, opt.lag);
						}

					} else {
						// Implement smooth scrolling.
						motion.reset(130);
					}
					return true;

				} else {
					return false;
				}
			};

			// The scrollbar is at the beginning or end of its range.
			me.isAtEdge = function () {
				return value === 0 || value == me.limit;
			};

			ctor();
		};
	
	return this.each(function () {
		
		var valid = ["auto", "scroll"],
			$this = $(this);

		// Skip elements that do not have overflow set to auto or scroll.
		if ($.inArray($this.css("overflow-x"), valid) === -1 && $.inArray($this.css("overflow-y"), valid) === -1) {
			return;
		}

		// HTML injection.
		(function () {
			// Create wrapper element.
			var	wrapper = $("<div class='" + opt.class.root + "'>"),
				
				// CSS properties that affect layout.
				cssProp = [
					"height", "min-height", "max-height", "width", "min-width", "max-width",
					"margin", "border", "outline", "display", "position", "float", "clear",
					"visibility", "top", "right", "bottom", "left", "z-index", "overflow", "clip"
				],

				// Note, non-standard defaults: { display: block, position: absolute }.
				cssDefs = [
					"auto", "0", "none", "auto", "0", "none", "0", "none", "none", "block", "absolute",
					"none", "none", "visible", "auto", "auto", "auto", "auto", "auto", "visible", "auto"
				],
				
				skip = ["root", "content", "disabled", "active"];
			
			// If an ID exists, base wrapper's ID from it.
			wrapper.attr("id", "venscrollbar-" + $this.attr("id") !== undefined ? $this.attr("id") : $.guid++);

			// Move box and layout properties to wrapper element.
			$.each(cssProp, function (i) {
				wrapper.css(cssProp[i], $this.css(cssProp[i]));
				$this.css(cssProp[i], cssDefs[i]);
			});
			
			// Wrapper element needs to have a position other than static.
			if (wrapper.css("position") !== "absolute") {
				wrapper.css("position", "relative");
			}
			
			// The ID must be removed after the styles are copied.
			$this.removeAttr("id").addClass(opt.class.content);

			// Append each container element to wrapper.
			wrapper.append($.map(opt.class, function (value, key) {
				return $.inArray(key, skip) === -1 ? "<div class='" + value + "'></div>" : null;
			}).join(""));

			// Add wrapper to the DOM and relocate the content.
			$this.parent().append(wrapper);
			$this.detach();
			wrapper.children("." + opt.class.viewport).append($this);
		})();


		// Initialize plugin and store the resulting API object using the jQuery data method.
		$this.data("venscrollbar", (function () {
			var body = $this,
				root = $this.parent().parent(),
				viewport = $("> div." + opt.class.viewport, root),
				xBar,
				yBar,
				
				// Stops any inertial scrolling that may be going on.
				stopInertial = $.noop,
				
				onScroll = function (e) {
					stopInertial();

					var ui = e.originalEvent.shiftKey || e.axis === 1 ? xBar : yBar;
					ui.val(ui.val() + opt.delta.medium * (e.wheelDelta < 0 ? 1 : -1));

					if (opt.wheelLock || !ui.isAtEdge()) {
						e.preventDefault();
					}
				},

				onOverflowChanged = function (e) {
					xBar.overflow(e.x);
					yBar.overflow(e.y);
				},

				onDrag = function (e) {
					xBar.val(xBar.val() + e.delta.x * -xBar.ratio);
					yBar.val(yBar.val() + e.delta.y * -yBar.ratio);
				},

				onKeyDown = function (e) {
					if (e.keyCode > 31 && e.keyCode < 41) {
						stopInertial();
					}

					var ui = yBar;
					switch (e.keyCode) {
						case 32: // spacebar
							yBar.val(yBar.val() + opt.delta.large);
							break;
						case 33: // pageup
							yBar.val(yBar.val() - opt.delta.large);
							break;
						case 34: // pagedown
							yBar.val(yBar.val() + opt.delta.large);
							break;
						case 35: // end
							yBar.val(yBar.limit);
							break;
						case 36: // home
							yBar.val(0);
							break;
						case 37: // left
							xBar.val(xBar.val() - opt.delta.small);
							ui = xBar;
							break;
						case 38: // up
							yBar.val(yBar.val() - opt.delta.small);
							break;
						case 39: // right
							xBar.val(xBar.val() + opt.delta.small);
							ui = xBar;
							break;
						case 40: // down
							yBar.val(yBar.val() + opt.delta.small);
							break;
						default:
							return;
					}

					if (opt.wheelLock || !ui.isAtEdge()) {
						e.preventDefault();
					}
				},

				onAnchorClicked = function (e) {
					stopInertial();

					var hash = $(this).attr("href"),
						target = $(hash),
						id = target.attr("id"),
				
						getOffset = function (el, prop) {
							var offset = el.position()[prop];
							if (!el.offsetParent().is(body)) {
								offset += getOffset(el.offsetParent(), prop);
							}
							return offset;
						};

					// Position the scrollbar where it needs to be.
					xBar.val(getOffset(target, "left") * xBar.ratio);
					yBar.val(getOffset(target, "top") * yBar.ratio);

					// Temporarily remove the id from the target so we can update the
					// hash without having the window scroll.
					target.attr("id", "");
					window.location.hash = hash;
					target.attr("id", id);

					// Prevent default and scroll to the top of the root element.
					$(window).scrollTop(root.offset().top);
					e.preventDefault();
				},
				
				onHashChanged = function (e) {
					var validElems = e.data.filter("a[href='" + e.hash + "']");
					if (validElems.length > 0) {
						onAnchorClicked.apply(validElems[0], [$.Event()]);
					}
				},

				onSelectionStart = function (e) {
					var intervalID = 0,
						xStep = 0,
						yStep = 0,
						elem = $(this);

					rootElem.bind("mousemove.select", function (e) {
						var offset = elem.offset(),
							limit = {
								top: offset.top,
								left: offset.left,
								bottom: offset.top + elem.height(),
								right: offset.left + elem.width()
							};

						yStep = e.pageY < limit.top ? Math.floor((e.pageY - limit.top) / 5) :
							e.pageY > limit.bottom ? Math.floor((e.pageY - limit.bottom) / 5) :
							0;

						xStep = e.pageX < limit.left ? Math.floor((e.pageX - limit.left) / 5) :
							e.pageX > limit.right ? Math.floor((e.pageX - limit.right) / 5) :
							0;

						if (xStep !== 0 || yStep !== 0) {
							if (intervalID === 0) {
								intervalID = setInterval(function() {
									xBar.val(xBar.val() + xStep);
									yBar.val(yBar.val() + yStep);
								}, 30);
							}

						} else {
							clearInterval(intervalID);
							intervalID = 0;
						}

					}).bind("mouseup.select", function () {
						clearInterval(intervalID);
						rootElem.unbind("mousemove.select").unbind("mouseup.select");
					});
				};

			// Set default styles.
			body.css("position", "absolute");
			viewport.css({
				"overflow": "hidden",
				"position": "absolute"
			});

			xBar = new ScrollBar(
				$("> div." + opt.class.xbar, root),
				$("> div." + opt.class.xtrack, root),
				viewport,
				body,
				1,
				root.css("overflow-x")
			);

			yBar = new ScrollBar(
				$("> div." + opt.class.ybar, root),
				$("> div." + opt.class.ytrack, root),
				viewport,
				body,
				2,
				root.css("overflow-y")
			);

			// Mousewheel support.
			if (opt.wheel) {
				sink.mousewheel.bind(root, onScroll);
			}

			// Live support.
			if (opt.live) {
				sink.propertychanged.bind(root, sink.propertychanged.comparers.overflow, onOverflowChanged);
			}

			// Touch and grab support.
			if (opt.grab || opt.touch) {
				var cookie = sink.drag.bind(body, onDrag, { mobile: opt.touch, desktop: opt.grab, inertial: opt.inertial });

				stopInertial = function () {
					sink.drag.stopInertial(cookie);
				};
				xBar.stopInertial = stopInertial;
				yBar.stopInertial = stopInertial;
			}
			
			// Keyboard support.
			if (opt.keyboard) {
				root[0].tabIndex = 0;
				root.bind("keydown", onKeyDown);
			}

			// Anchor support.
			if (opt.anchor) {
				var	gotoElem = null,
					anchors = body.find("[id]")
						.map(function () {
							var hash = "#" + $(this).attr("id"),
								anchor = $("a[href='" + hash + "']");

							if (window.location.hash === hash) {
								gotoElem = anchor;
							}

							return anchor.length > 0 ? anchor[0] : null;
						})
						.bind("click.venscrollbar", onAnchorClicked);

				sink.propertychanged.bind(window, sink.propertychanged.comparers.hash, onHashChanged, null, anchors);
				if (gotoElem) {
					onAnchorClicked.apply(gotoElem, [$.Event()]);
				}
			}

			// Selection support only if opt.grab is false.
			if (opt.select && !opt.grab) {
				viewport.bind("mousedown.select", onSelectionStart);
			} else {
				fn.setSelection(body, false);
			}

			return { x: "test" };
		})());
	});
};
