/// <reference path="https://ajax.googleapis.com/ajax/libs/jquery/1.6.1/jquery.js" />

// Events
$.event.special.mouseywheel = {

	add: function (data) {

		// Copy the user's handler because we're going to replace it.
		var _handler = data.handler;

		// Replace with a wrapper.
		data.handler = function (_e) {
			_e = _e || window.event;
			var e = new $.Event("mouseywheel");
			e.originalEvent = _e;

			// Normalize values: -1 == down, 1 == up.
			// IE uses e.wheelDelta. Everyone else uses e.detail.
			e.wheelDelta =
					_e.wheelDelta ?
						_e.wheelDelta > 0 ? 1 :
						_e.wheelDelta < 0 ? -1 :
						0 :
					_e.detail ?
						_e.detail > 0 ? -1 :
						_e.detail < 0 ? 1 :
						0 :
					0;

			// Provide an easier interface for preventing the document from scrolling.
			e.preventDefault = function () {
				if (_e.stopPropagation) _e.stopPropagation();
				if (_e.preventDefault) _e.preventDefault();
				_e.cancelBubble = true;
				_e.cancel = true;
				_e.returnValue = false;
			};

			if (_e.distance !== undefined)
				e.distance = _e.distance;

			// Firefox uses e.axis. Webkit uses e.wheelDeltaX.
			e.axis = _e.axis ? _e.axis : _e.wheelDeltaX ? 1 : 2;

			// Invoke the user's event handler, passing the custom event object.
			_handler.apply(this, [e]);
		};

		
		if (this.ontouchstart !== undefined) {
			// This event plugin does not handle gestures.
			return;

		} else if (this.addEventListener) {
			this.addEventListener("mousewheel", data.handler, false);
			this.addEventListener("DOMMouseScroll", data.handler, false); // For Firefox

		} else
			this.onmousewheel = data.handler; // For IE
	},

	remove: function (data) {
		if (this.ontouchstart !== undefined) {
			// This event plugin does not handle gestures.
			return;

		} else if (this.removeEventListener) {
			this.removeEventListener("mousewheel", data.handler, false);
			this.removeEventListener("DOMMouseScroll", data.handler, false); // For Firefox

		} else
			this.onmousewheel = null; // For IE
	}
};


$.event.special.sizechanged = {
	add: function (handleObj) {
		var me = this;

		// Initialize namespace
		if (me.venscrollbar === undefined) me.venscrollbar = {};

		var data = me.venscrollbar.sizechanged = {
			h: me.clientHeight,
			w: me.clientWidth,
			p: setInterval(function () {

				if (data.h != me.clientHeight || data.w != me.clientWidth) {
					var e = new $.Event("sizechanged");
					e.oldSize = {
						width: data.w,
						height: data.h
					};
					e.newSize = {
						width: me.clientWidth,
						height: me.clientHeight
					};
					e.data = handleObj.data;
					handleObj.handler.apply(me, [e]);
				}
				data.h = me.clientHeight;
				data.w = me.clientWidth;

			}, 25)
		};
	},

	remove: function () {
		clearInterval(this.venscrollbar.sizechanged.p);
		this.venscrollbar.sizechanged = null;
	}
};

$.event.special.drag = {
	add: function (handleObj) {
		
		var coord = null;
		var me = $(this);

		// IE 8 and 7 don't support the mousemove event on the window object.
		var global = $.support.changeBubbles ? window : document;

		var onMouseDown = function () {
			$(global).bind("mousemove.drag", onMouseMove).bind("mouseup.drag", onMouseUp);
		};

		var onMouseMove = function (e) {
			if (coord == null)
				coord = {
					x: e.pageX,
					y: e.pageY
				};
			else {
				var evt = new $.Event("drag");
				evt.delta = {
					x: Math.floor(e.pageX - coord.x),
					y: Math.floor(e.pageY - coord.y)
				};
				coord = {
					x: e.pageX,
					y: e.pageY
				};
				evt.data = handleObj.data;
				handleObj.handler.apply(this, [evt]);
			}
		};

		var onMouseUp = function () {
			$(global).unbind("mousemove.drag").unbind("mouseup.drag");
			coord = null;
		};

		var onTouchStart = function (e) {
			if (e.targetTouches.length > 0) {
				this.ontouchmove = onTouchMove;
				this.ontouchend = onTouchEnd;
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
				this.ontouchstart = null;
				coord = null;
			}
		};

		if (this.ontouchstart !== undefined) {
			// Mobile support
			this.ontouchstart = onTouchStart;

		} else if (!handleObj.data.onlyMobile) {
			// Desktop support
			me.bind("mousedown.drag", onMouseDown);

			// Disable text selection
			if (this.onselectstart !== undefined)
				this.onselectstart = function() { return false; }
			else if (this.style.MozUserSelect !== undefined)
				this.style.MozUserSelect = "none";
			else
				this.onmousedown = function() { return false; }
		}
	},

	remove: function () {
		$(this).unbind("mousedown").unbind("mousemove").unbind("mouseup");

		// Enable selection
		if (this.onselectstart !== undefined)
			this.onselectstart = null;
		else if (this.style.MozUserSelect !== undefined)
			this.style.MozUserSelect = "all";
		else
			this.onmousedown = null;
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
			arrow: 5,
			wheel: 10,
			track: 15
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
		noWheel: false,				// disable mousewheel support
		noSelection: false, 		// disable mouse selection
		noTouch: false,				// disable touch support
		overlay: false, 			// overlay the scrollbar on top of the content
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
			var me = this, overflow_x = "", overflow_y = "";
	
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

			// Effective overflow property for root since root always has a real value of "hidden".
			// (auto|scroll)
			this.overflow = {
				x: function (v) {
					if (v == undefined) return overflow_x;
					if (overflow_x != v) { overflow_x = v; onStateChanged(me.ui.hbar); }
				},
				y: function (v) {
					if (v == undefined) return overflow_y;
					if (overflow_y != v) { overflow_y = v; onStateChanged(me.ui.vbar); }
				}
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
				if (me.dom.vbar.css("position") == "static") me.dom.vbar.css({"position":"absolute", "right":"0", "top":"0"});
				if (me.dom.hbar.css("position") == "static") me.dom.hbar.css({"position":"absolute", "left":"0", "bottom":"0"});
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

				// Add jQuery event handlers.
				me.dom.root.bind("mouseywheel", onScroll);
				me.dom.window.bind("sizechanged", onSizeChanged);
				me.dom.body.bind("sizechanged", onSizeChanged);
				me.dom.vtrack.bind("sizechanged", {ui: "vbar", dom: "vtrack", prop: "height"}, onTrackSizeChanged);
				me.dom.htrack.bind("sizechanged", {ui: "hbar", dom: "htrack", prop: "width"}, onTrackSizeChanged);
				me.dom.body.bind("drag", {source: 3}, onDrag);
				me.dom.vbar.bind("drag", {source: 1}, onDrag);
				me.dom.hbar.bind("drag", {source: 2}, onDrag);
			};

			// Update ratios and sizes.
			var onSizeChanged = function () {
				me.ui.vbar.ratio = me.ui.vbar.range() / me.dom.body.height();
				me.ui.vbar.size(me.ui.vbar.ratio * me.dom.window.height());

				me.ui.hbar.ratio = me.ui.hbar.range() / me.dom.body.width();
				me.ui.hbar.size(me.ui.hbar.ratio * me.dom.window.width());
			};

			// Also runs when me.overflow.(x|y) changes.
			// b.state: 0 = disabled, 1 = enabled.
			var onStateChanged = function (b) {
				var ovrflo = me.overflow[b.axis == 1 ? "x" : "y"]();

				// If overflow is set to auto, then hide if disabled and show if enabled.
				// Else, add disabled class if disabled or remove disabled class if enabled.
				if (ovrflo == "auto") b.dom.css("visibility", b.state() == 1 ? "visible" : "collapse");
				else b.state() == 1 ? b.dom.removeClass(opt.classes.disabled) : b.dom.addClass(opt.classes.disabled);
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
				var prop = e.originalEvent.shiftKey || e.axis == 1 ? "hbar" : "vbar";
				me.ui[prop].pos(me.ui[prop].pos() + opt.delta.wheel * (e.wheelDelta < 0 ? 1 : -1));

				if (opt.lockWheel || !me.ui[prop].isAtEdge()) e.preventDefault();
			};

			var onTrackSizeChanged = function (e) {
				me.ui[e.data.ui].range(me.dom[e.data.dom][e.data.prop](), true);
				onSizeChanged();
			};

			// e.data.source (1|2|3): 1 = vertical bar, 2 = horizontal bar, 3 = body
			var onDrag = function (e) {
				switch (e.data.source) {
					case 1:
						me.ui.vbar.pos(me.ui.vbar.pos() + e.delta.y);
						break;
					case 2:
						me.ui.hbar.pos(me.ui.hbar.pos() + e.delta.x);
						break;
					case 3:
						me.ui.hbar.pos(me.ui.hbar.pos() + e.delta.x * -me.ui.hbar.ratio);
						me.ui.vbar.pos(me.ui.vbar.pos() + e.delta.y * -me.ui.vbar.ratio);
				}
			};

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
				}
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
			
			// Create wrapper element (root).
			var root = $("<div class='" + opt.classes.view + "'>");
			
			// If an ID exists, base root's ID from it.
			root.attr("id", "venscrollbar-" + $(elem).attr("id") !== undefined ? $(elem).attr("id") : guid++);

			// Move box and layout properties to root element.
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
				root.css(cssProps[i], $(elem).css(cssProps[i]));
				$(elem).css(cssProps[i], cssDefs[i]);
			}

			root.css("overflow", "hidden");
			if (root.css("position") != "absolute") root.css("position", "relative");
			
			// The ID must be removed after the styles are copied.
			$(elem).removeAttr("id").addClass(opt.classes.content);

			root.append("<div class='" + opt.classes.window + "'>");
			$(elem).parent().append(root);
			$(elem).detach();
			root.children().append(elem);

			// Append each container element to root.
			for (var p in opt.classes) {
				if ($.inArray(p, ["view", "content", "disabled", "active", "window"]) > -1) continue;
				root.append("<div class='" + opt.classes[p] + "'>");
			}
		}
	};


	return this.each(function () {
				
		// Skip elements that do not have overflow set to auto or scroll.
		var overflow = {
			x: $(this).css("overflow-x"),
			y: $(this).css("overflow-y")
		};
		if ($.inArray($(this).css("overflow"), ["auto", "scroll"]) == -1) return;

		// Inject html.
		fn.init(this);
		
		// Instantiate a new View.
		var v = new cls.View(this);
		v.overflow.x(overflow.x);
		v.overflow.y(overflow.y);
		
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