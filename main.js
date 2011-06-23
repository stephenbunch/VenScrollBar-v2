/// <reference path="https://ajax.googleapis.com/ajax/libs/jquery/1.6.1/jquery.js" />

var sink = {
	mousewheel: {
		_storage: {},

		bind: function (elem, callback, data) {
			if (elem instanceof $) elem = elem[0];
			var handler = function (_e) {
				_e = _e || window.event;
				var e = {
					originalEvent: _e,

					// Normalize values: -1 == down, 1 == up.
					// IE uses e.wheelDelta. Everyone else uses e.detail.
					wheelDelta:
							_e.wheelDelta ?
								_e.wheelDelta > 0 ? 1 :
								_e.wheelDelta < 0 ? -1 :
								0 :
							_e.detail ?
								_e.detail > 0 ? -1 :
								_e.detail < 0 ? 1 :
								0 :
							0,

					// Provide an easier interface for preventing the document from scrolling.
					preventDefault: function () {
						if (_e.stopPropagation) _e.stopPropagation();
						if (_e.preventDefault) _e.preventDefault();
						_e.cancelBubble = true;
						_e.cancel = true;
						_e.returnValue = false;
					},

					// Firefox uses e.axis. Webkit uses e.wheelDeltaX.
					axis: _e.axis ? _e.axis : _e.wheelDeltaX ? 1 : 2,

					data: data
				};

				// Invoke the user's event handler, passing the custom event object.
				callback.apply(elem, [e]);
			};
		
			if (elem.ontouchstart !== undefined) {
				// This event plugin does not handle gestures.
				return;

			} else if (elem.addEventListener) {
				elem.addEventListener("mousewheel", handler, false);
				elem.addEventListener("DOMMouseScroll", handler, false); // For Firefox

			} else
				elem.onmousewheel = handler; // For IE

			var cookie = ($.guid++).toString();
			sink.mousewheel._storage[cookie] = {
				elem: elem,
				handler: handler
			};

			return cookie;
		},

		unbind: function (cookie) {
			var elem = sink.mousewheel._storage[cookie].elem;
			var handler = sink.mousewheel._storage[cookie].handler;
			if (elem.removeEventListener) {
				elem.removeEventListener("mousewheel", handler, false);
				elem.removeEventListener("DOMMouseScroll", handler, false); // For Firefox

			} else
				elem.onmousewheel = null; // For IE

			delete sink.mousewheel._storage[cookie];
		}
	},

	drag: {
		_storage: {},
		
		// IE 8 and 7 don't support the mousemove event on the window object.
		_root: $.support.changeBubbles ? window : document,

		bind: function (elem, callback, data) {
			if (elem instanceof $) elem = elem[0];
			var cookie = ($.guid++).toString();
			sink.drag._storage[cookie] = {
				elem: elem
			};

			var coord = null;
			var me = $(elem);
			var isNewDrag = true;
		
			var onMouseDown = function () {
				$(sink.drag._root).bind("mousemove.drag", onMouseMove).bind("mouseup.drag", onMouseUp);
			};

			var onMouseMove = function (e) {
				if (coord == null)
					coord = {
						x: e.pageX,
						y: e.pageY
					};
				else {
					var evt = {
						delta: {
							x: Math.floor(e.pageX - coord.x),
							y: Math.floor(e.pageY - coord.y)
						},
						pageY: e.pageY,
						pageX: e.pageX,
						isNewDrag: isNewDrag,
						data: data
					};

					coord = {
						x: e.pageX,
						y: e.pageY
					};
					isNewDrag = false;
				
					callback.apply(elem, [evt]);
				}
			};

			var onMouseUp = function () {
				$(sink.drag._root).unbind("mousemove.drag").unbind("mouseup.drag");
				coord = null;
				isNewDrag = true;
			};

			var onTouchStart = function (e) {
				if (e.targetTouches.length > 0) {
					elem.ontouchmove = onTouchMove;
					elem.ontouchend = onTouchEnd;
				}
			};

			var onTouchMove = function (e) {
				if (e.targetTouches.length == 1) {
					e.preventDefault();
					onMouseMove({
						pageX: e.targetTouches[0].pageX,
						pageY: e.targetTouches[0].pageY
					});
				}
			};

			var onTouchEnd = function (e) {
				if (e.targetTouches.length == 0) {
					elem.ontouchstart = null;
					coord = null;
				}
			};

			if (elem.ontouchstart !== undefined && data.mobile) {
				// Mobile support
				elem.ontouchstart = onTouchStart;

			} else if (data.desktop) {
				// Desktop support
				me.bind("mousedown.drag", onMouseDown);

				// Disable text selection
				if (elem.onselectstart !== undefined)
					elem.onselectstart = function() { return false; };
				else if (elem.style.MozUserSelect !== undefined)
					elem.style.MozUserSelect = "none";
				else
					elem.onmousedown = function() { return false; };
			}

			return cookie;
		},

		unbind: function (cookie) {
			var elem = sink.drag._storage[cookie];
			$(elem).unbind("mousedown.drag").unbind("mousemove.drag").unbind("mouseup.drag");

			// Enable selection
			if (elem.onselectstart !== undefined)
				elem.onselectstart = null;
			else if (elem.style.MozUserSelect !== undefined)
				elem.style.MozUserSelect = "all";
			else
				elem.onmousedown = null;

			delete sink.drag._storage[cookie];
		}
	},

	propertychanged: {
		_storage: {},

		bind: function (elem, comparer, callback, data) {
			if (!(elem instanceof $)) elem = $(elem);
			var cookie = ($.guid++).toString();
			sink.propertychanged._storage[cookie] = {
				
				poll: setInterval(function () {
					var e = comparer(cookie);
					if (e) {
						e.data = data;
						callback.apply(elem[0], [e]);
					}
				}, 50),

				elem: elem
			};

			return cookie;
		},

		unbind: function (cookie) {
			clearInterval(sink.propertychanged._storage[cookie].poll);
			delete sink.propertychanged._storage[cookie];
		},

		comparers: {
			size: function (cookie) {
				var elem = sink.propertychanged._storage[cookie].elem;
				var w = sink.propertychanged._storage[cookie].w;
				var h = sink.propertychanged._storage[cookie].h;
				var e = null;
				if (w !== undefined) {
					if (h != elem.outerWidth() || w != elem.outerWidth()) {
						e = {
							oldSize: {
								width: w,
								height: h
							},
							newSize: {
								width: elem.outerWidth(),
								height: elem.outerWidth()
							}
						};
					}
				}
				sink.propertychanged._storage[cookie].h = elem.outerWidth();
				sink.propertychanged._storage[cookie].w = elem.outerWidth();
				
				return e;
			},

			overflow: function (cookie) {
				var e = null;
				var elem = sink.propertychanged._storage[cookie].elem;
				var x = elem.css("overflow-x");
				var y = elem.css("overflow-y");
				if (sink.propertychanged._storage[cookie].x !== undefined) {
					if (x != sink.propertychanged._storage[cookie].x || y != sink.propertychanged._storage[cookie].y) {
						e = {
							x: x,
							y: y
						};
					}
				}
				sink.propertychanged._storage[cookie].x = x;
				sink.propertychanged._storage[cookie].y = y;
				return e;
			}

//			hash: function (cookie) {
//				var e = null;
//				var hash = window.location.hash;
//				if (sink.propertychanged._storage[cookie].value !== undefined) {
//					if (hash != sink.propertychanged._storage[cookie].value) {
//						e = { hash: hash };
//					}
//				}
//				sink.propertychanged._storage[cookie].value = hash;
//				return e;
//			}
		}
	}
};


// Plugin
$.fn.VenScrollBar = function (opt) {
	
	var def = {
		autoHide: false, 			// hide scrollbar after a certain period of inactivity
		classes: {
			// root element classes
			vtrack: "vtrack",		// vertical track
			htrack: "htrack",		// horizontal track
			vbar: "vbar",			// vertical bar
			hbar: "hbar",			// horizontal bar
			up: "up",				// up arrow
			down: "down",			// down arrow
			left: "left",			// left arrow
			right: "right",			// right arrow
			view: "view",			// root element
			window: "window",		// visible part of the content
			content: "content",		// original element in jQuery selector

			// pseudo classes
			disabled: "disabled",	// a class for when the scrollbar is disabled
			active: "active"		// an alternative to the buggy :active pseudo selector
		},
		compatibility: false,		// compatibility mode for VenScrollBar v1.0 setup code
		delta: {					// scroll increments in pixels
			small: 5,
			medium: 10,
			large: 15
		},
		grab: false, 				// use the hand tool to move content around
		html: {						// custom html to inject into root elements
			vbar: "",
			hbar: "",
			vtrack: "",
			htrack: "",
			up: "",
			down: "",
			left: "",
			right: ""
		},
		inertial: false, 			// enable inertial scrolling like on iOS devices
		keyboard: true, 			// enable keyboard navigation support
		live: true,					// poll for size changes instead of using Refresh()
		lockWheel: false, 			// disable mousewheel from scrolling the page
		wheel: true,				// enable mousewheel support
		selection: true, 			// enable content selection via the mouse
		touch: true,				// enable touch support
		anchor: true,				// handle anchor click events
		smoothScroll: false,		// use animation to make scrolling smooth like in Firefox
		themeRoller: false,			// be compatible with jQuery UI ThemeRoller themes
		wave: false					// mimic Google Wave behavior
	};

	// Merge two objects recursively, modifying the first.
	opt = $.extend(true, def, opt);

	var guid = 0;

	
	// Classes
	var cls = {
		View: function (elem) {
			var me = this;
	
			// jQuery selectors
			this.dom = {
				root: {}, body: {}, up: {}, down: {}, left: {}, right: {},
				vbar: {}, hbar: {}, vtrack: {}, htrack: {}, window: {}
			};

			// Info objects
			this.ui = {
				vbar: {},
				hbar: {}
			};
			
			var ctor = function () {
				
				// Initialize selectors.
				me.dom.body = $(elem);
				me.dom.root = me.dom.body.parent().parent();
				for (var p in me.dom) {
					if (p == "root" || p == "body") continue;
					me.dom[p] = $("> div." + opt.classes[p], me.dom.root);
				}

				// Store a reference in the element.
				me.dom.root.data("VenScrollBar", me);

				// Set default styles.
				if (me.dom.vbar.css("position") == "static")
					me.dom.vbar.css({"position":"absolute", "right":"0", "top":"0"});
				if (me.dom.hbar.css("position") == "static")
					me.dom.hbar.css({"position":"absolute", "left":"0", "bottom":"0"});
				me.dom.body.css("position", "absolute");
				me.dom.window.css({"overflow":"hidden", "position":"absolute"});
				
				// Initialize vertical scrollbar
				me.ui.vbar = new cls.Bar();
				me.ui.vbar.axis = 2;
				me.ui.vbar.dom = me.dom.vbar;
				me.ui.vbar.range(me.dom.vtrack.height());
				me.ui.vbar.evt.stateChanged = onStateChanged;
				me.ui.vbar.evt.positionChanged = onPositionChanged;

				// Initialize horizontal scrollbar
				me.ui.hbar = new cls.Bar();
				me.ui.hbar.axis = 1;
				me.ui.hbar.dom = me.dom.hbar;
				me.ui.hbar.range(me.dom.htrack.width());
				me.ui.hbar.evt.stateChanged = onStateChanged;
				me.ui.hbar.evt.positionChanged = onPositionChanged;

				// Initialize ratios and sizes.
				onSizeChanged();

				// Add mousewheel support
				if (opt.wheel)
					sink.mousewheel.bind(me.dom.root, onScroll);

				// Add "live" support.
				if (opt.live) {
					sink.propertychanged.bind(me.dom.root, sink.propertychanged.comparers.overflow, onOverflowChanged);
					sink.propertychanged.bind(me.dom.window, sink.propertychanged.comparers.size, onSizeChanged);
					sink.propertychanged.bind(me.dom.body, sink.propertychanged.comparers.size, onSizeChanged);
					sink.propertychanged.bind(
						me.dom.vtrack,
						sink.propertychanged.comparers.size,
						onTrackSizeChanged,
						{
							ui: me.ui.vbar,
							dom: me.dom.vtrack,
							prop: "outerHeight"
						}
					);
					sink.propertychanged.bind(
						me.dom.htrack,
						sink.propertychanged.comparers.size,
						onTrackSizeChanged,
						{
							ui: me.ui.hbar,
							dom: me.dom.htrack,
							prop: "outerWidth"
						}
					);
				}

				// Add touch and grab support
				if (opt.grab || opt.touch) {
					sink.drag.bind(me.dom.body, onDrag, {source: 3, mobile: opt.touch, desktop: opt.grab});
					sink.drag.bind(me.dom.vbar, onDrag, {source: 1, mobile: opt.touch, desktop: true});
					sink.drag.bind(me.dom.hbar, onDrag, {source: 2, mobile: opt.touch, desktop: true});
				}

				// Add keyboard support
				if (opt.keyboard) {
					me.dom.root[0].tabIndex = 0;
					me.dom.root.bind("keydown", onKeyDown);
				}

				// Add anchor support
				if (opt.anchor) {
					var possibleAnchors = $(me.dom.body).find("[id]");
					var anchors = [];
					var goto = null;
					for (var i = 0; i < possibleAnchors.length; i++) {
						var hash = "#" + possibleAnchors.eq(i).attr("id");
						var anchor = $("a[href='" + hash + "']");
						if (anchor.length > 0) anchors.push(anchor[0]);
						if (window.location.hash == hash) goto = anchor;
					}
					$(anchors).bind("click.venscrollbar", onAnchorClicked);
					//anchors = $(anchors).bind("click.venscrollbar", onAnchorClicked);
					//sink.propertychanged.bind(window, sink.propertychanged.comparers.hash, onHashChanged, anchors);
					if (goto) onAnchorClicked.apply(goto, [$.Event()]);
				}

				// Take into account the css overflow properties.
				onOverflowChanged();
			};

			// Update ratios and sizes.
			var onSizeChanged = function () {
				me.ui.vbar.ratio = me.ui.vbar.range() / me.dom.body.outerHeight();
				me.ui.vbar.size(me.ui.vbar.ratio * me.dom.window.outerHeight());

				me.ui.hbar.ratio = me.ui.hbar.range() / me.dom.body.outerWidth();
				me.ui.hbar.size(me.ui.hbar.ratio * me.dom.window.outerWidth());
			};

			var onOverflowChanged = function (e) {
				onStateChanged(me.ui.vbar);
				onStateChanged(me.ui.hbar);
			};

			// b.state: 0 = disabled, 1 = enabled.
			var onStateChanged = function (b) {
				var overflow = me.dom.root.css("overflow-" + (b.axis == 1 ? "x" : "y"));
				
				// If overflow is set to auto and state is disabled or if overflow is set to
				// hidden, then hide. Add/remove the disabled class as necessary.
				b.dom.css("visibility", overflow == "auto" && b.state() == 0 || overflow == "hidden" ? "collapse" : "visible");
				if (b.state() == 1)
					b.dom.removeClass(opt.classes.disabled);
				else
					b.dom.addClass(opt.classes.disabled);
			};

			// Move the body when the scrollbar's position changes. Multiply by -1 because
			// the body needs to go in the opposite direction than the scrollbar.
			var onPositionChanged = function (b) {
				var prop = b.axis == 1 ? "left" : "top";
				me.dom.body.css(prop, b.pos() / b.ratio * -1);
			};

			// Update the position of the scrollbar when the wheel scrolls.
			// e.axis: 1 = x, 2 = y
			var onScroll = function (e) {
				var ui = e.originalEvent.shiftKey || e.axis == 1 ? me.ui.hbar : me.ui.vbar;
				ui.pos(ui.pos() + opt.delta.medium * (e.wheelDelta < 0 ? 1 : -1));

				if (opt.lockWheel || !ui.isAtEdge()) e.preventDefault();
			};

			var onTrackSizeChanged = function (e) {
				e.data.ui.range(e.data.dom[e.data.prop](), true);
				onSizeChanged();
			};


			// Prevent the mouse from dragging the scrollbar when its position is not
			// the same as when it first clicked on the scrollbar.
			var mouseLastOK = { x: 0, y: 0 };

			// e.data.source (1|2|3): 1 = vertical bar, 2 = horizontal bar, 3 = body
			var onDrag = function (e) {
				switch (e.data.source) {
					case 1:
						if (!e.isNewDrag) {
							if (e.delta.y < 0 && e.pageY >= mouseLastOK.y || e.delta.y > 0 && e.pageY <= mouseLastOK.y)
								return;
						}
						if (me.ui.vbar.pos(me.ui.vbar.pos() + e.delta.y) || e.isNewDrag)
							mouseLastOK.y = e.pageY;
						break;

					case 2:
						if (!e.isNewDrag) {
							if (e.delta.x < 0 && e.pageX >= mouseLastOK.x || e.delta.x > 0 && e.pageX <= mouseLastOK.x)
								return;
						}
						if (me.ui.hbar.pos(me.ui.hbar.pos() + e.delta.x) || e.isNewDrag)
							mouseLastOK.x = e.pageX;
						break;

					case 3:
						me.ui.hbar.pos(me.ui.hbar.pos() + e.delta.x * -me.ui.hbar.ratio);
						me.ui.vbar.pos(me.ui.vbar.pos() + e.delta.y * -me.ui.vbar.ratio);
				}
			};

			var onKeyDown = function (e) {
				// 32: spacebar
				// 33: pageup
				// 34: pagedown
				// 35: end
				// 36: home
				// 37: left
				// 38: up
				// 39: right
				// 40: down
				var ui = me.ui.vbar;
				switch (e.keyCode) {
					case 32:
						me.ui.vbar.pos(me.ui.vbar.pos() + opt.delta.large);
						break;
					case 33:
						me.ui.vbar.pos(me.ui.vbar.pos() + -opt.delta.large);
						break;
					case 34:
						me.ui.vbar.pos(me.ui.vbar.pos() + opt.delta.large);
						break;
					case 35:
						me.ui.vbar.pos(me.ui.vbar.range() - me.ui.vbar.size());
						break;
					case 36:
						me.ui.vbar.pos(0);
						break;
					case 37:
						me.ui.hbar.pos(me.ui.hbar.pos() + -opt.delta.small);
						ui = me.ui.hbar;
						break;
					case 38:
						me.ui.vbar.pos(me.ui.vbar.pos() + -opt.delta.small);
						break;
					case 39:
						me.ui.hbar.pos(me.ui.hbar.pos() + opt.delta.small);
						ui = me.ui.hbar;
						break;
					case 40:
						me.ui.vbar.pos(me.ui.vbar.pos() + opt.delta.small);
						break;
					default:
						return;
				}

				if (opt.lockWheel || !ui.isAtEdge()) e.preventDefault();
			};

			var onAnchorClicked = function (e) {
				var hash = $(this).attr("href");
				var target = $(hash);
				
				var getOffset = function (el, prop) {
					var offset = el.position()[prop];
					if (!el.offsetParent().is(me.dom.body)) {
						offset += getOffset(el.offsetParent(), prop);
					}
					return offset;
				};

				// Position the scrollbar where it needs to be.
				me.ui.hbar.pos(getOffset(target, "left") * me.ui.hbar.ratio);
				me.ui.vbar.pos(getOffset(target, "top") * me.ui.vbar.ratio);

				// Temporarily remove the id from the target so we can update the
				// hash without having the window scroll.
				var id = target.attr("id");
				target.attr("id", "");
				window.location.hash = hash;
				target.attr("id", id);

				// Prevent default and scroll to the top of the root element.
				$(window).scrollTop(me.dom.root.offset().top);
				e.preventDefault();
			};

//			// e.data holds the anchors variable created in the constructor.
//			var onHashChanged = function (e) {
//				var validElems = e.data.filter("a[href='" + e.hash + "']");
//				if (validElems.length > 0) {
//					onAnchorClicked.apply(validElems[0], [$.Event()]);
//				}
//			};

			ctor();
		},

		Bar: function () {
			var me = this, d = 0, s = 0, r = 0, p = 0, st = 0, microDelta = 0;

			// Scrollbar axis (1|2). 1 = x, 2 = y
			this.axis = 0;

			// Scrollbar track length.
			this.range = function (v, dontUpdate) {
				if (v == undefined) return d;
				if (d != v) {
					d = v;
					if (!dontUpdate) {
						var prop = me.axis == 2 ? "height" : "width";
						me.dom[prop](me.size());
					}
					me.state(me.size() < me.range());
				}
			};

			// Scrollbar (height|width) depending on axis.
			this.size = function (v) {
				if (v == undefined) return s;
				if (s != v) {
					s = v;
					var prop = me.axis == 2 ? "height" : "width";
					me.dom[prop](me.size());
					me.state(me.size() < me.range());
				}
			};

			// Ratio is the range (track) / body (content) length.
			this.ratio = 1;

			// The (top|left) position of scrollbar depending on axis.
			// Returns true if a change was made.
			this.pos = function (newValue) {
				// We only care about position if the scrollbar is enabled.
				if (me.state() == 0) return p;
				if (newValue === undefined) return p;

				// Position cannot go outside of the range.
				if (newValue < 0) newValue = 0;
				if (newValue > me.range() - me.size()) newValue = me.range() - me.size();

				if (p != newValue) {
					p = newValue;

					var prop = me.axis == 1 ? "left" : "top";
					me.dom.css(prop, newValue);
					
					// Raise positionChanged event.
					me.evt.positionChanged(me);

					return true;
				}
				else return false;
			};

			// jQuery selector to (v|h)bar element
			this.dom = $();

			// State of scrollbar (0|1): 0 = disabled, 1 = enabled
			this.state = function (v) {
				if (v === undefined) return st;
				if (st != v) {
					st = v;
					me.evt.stateChanged(me);
				}
			};

			// The scrollbar is at the beginning or end of its range.
			this.isAtEdge = function () {
				return me.pos() == 0 || me.pos() == me.range() - me.size();
			};

			// Events
			this.evt = {
				stateChanged: function (bar) { },
				positionChanged: function (bar) { }
			};

		}
	};


	// Functions
	var fn = {
		init: function (elem) {
			
			// Create wrapper element.
			var wrapper = $("<div class='" + opt.classes.view + "'>");
			
			// If an ID exists, base wrapper's ID from it.
			wrapper.attr("id", "venscrollbar-" + $(elem).attr("id") !== undefined ? $(elem).attr("id") : guid++);

			// Move box and layout properties to wrapper element.
			var cssProps = [
				"height", "min-height", "max-height", "width", "min-width", "max-width",
				"margin", "border", "outline", "display", "position", "float", "clear",
				"visibility", "top", "right", "bottom", "left", "z-index", "overflow", "clip"
			];
			// New defaults: display: block, position: absolute.
			var cssDefs = [
				"auto", "0", "none", "auto", "0", "none", "0", "none", "none", "block", "absolute",
				"none", "none", "visible", "auto", "auto", "auto", "auto", "auto", "visible", "auto"
			];
			for (var i = 0; i < cssProps.length; i++) {
				wrapper.css(cssProps[i], $(elem).css(cssProps[i]));
				$(elem).css(cssProps[i], cssDefs[i]);
			}

			if (wrapper.css("position") != "absolute") wrapper.css("position", "relative");
			
			// The ID must be removed after the styles are copied.
			$(elem).removeAttr("id").addClass(opt.classes.content);

			wrapper.append("<div class='" + opt.classes.window + "'>");
			$(elem).parent().append(wrapper);
			$(elem).detach();
			wrapper.children().append(elem);

			// Append each container element to wrapper.
			for (var p in opt.classes) {
				if ($.inArray(p, ["view", "content", "disabled", "active", "window"]) > -1) continue;
				wrapper.append("<div class='" + opt.classes[p] + "'>");
			}
		}
	};


	return this.each(function () {
				
		// Skip elements that do not have overflow set to auto or scroll.
		var valid = ["auto", "scroll"];
		if ($.inArray($(this).css("overflow-x"), valid) == -1 && $.inArray($(this).css("overflow-y"), valid) == -1)
			return;

		// Inject html.
		fn.init(this);
		
		// Instantiate a new View.
		var v = new cls.View(this);
		
	});
};


// Extras
$.expr[":"].notScrollPlugin = function (elem) {
	try {
		return !elem.venscrollbar.isScrollPlugin;
	} catch (ex) {
		return true;
	}
};

$.fn.closestParent = function (selector) {
	var elem = this;
	while (elem = elem.parent(), elem.length > 0 && !elem.is(selector));
	return elem;
};

$.fn.closestChildren = function (selector) {
	var elem = this;
	while (elem = elem.children(), elem.length > 0 && !elem.is(selector));
	return elem.filter(selector);
};