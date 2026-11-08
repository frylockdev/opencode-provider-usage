// @bun
// src/tui.tsx
import { createComponent as _$createComponent2 } from "@opentui/solid";
import { Plugin } from "@opencode/plugin/tui";
import { createSignal as createSignal2, onCleanup, onMount } from "solid-js";

// src/rpc.ts
import { Rpc } from "@opencode/plugin/rpc";
var OpenAIUsage = Rpc.define({
  id: "openai-usage",
  events: {},
  methods: { get: {
    input: { type: "object", additionalProperties: false },
    output: { type: "object", required: ["state", "checkedAt"], properties: {
      state: { enum: ["ready", "stale", "unavailable"] },
      checkedAt: { type: "number" },
      account: { type: "string" },
      usage: { type: "object" },
      updatedAt: { type: "number" },
      retryAt: { type: "number" },
      message: { type: "string" }
    }, additionalProperties: false }
  } }
});

// src/panel.tsx
import { memo as _$memo } from "@opentui/solid";
import { createComponent as _$createComponent } from "@opentui/solid";
import { setProp as _$setProp } from "@opentui/solid";
import { effect as _$effect } from "@opentui/solid";
import { insert as _$insert } from "@opentui/solid";
import { createTextNode as _$createTextNode } from "@opentui/solid";
import { insertNode as _$insertNode } from "@opentui/solid";
import { createElement as _$createElement } from "@opentui/solid";
import { For, Show, createSignal } from "solid-js";

// src/usage.ts
function progress(used, width) {
  const size = Math.max(0, Math.floor(width));
  const filled = Math.round(Math.min(100, Math.max(0, used)) / 100 * size);
  return { filled: "\u2501".repeat(filled), empty: "\u2501".repeat(size - filled) };
}
function remainingTime(resetAt, now) {
  if (resetAt === undefined)
    return "\u0432\u0440\u0435\u043C\u044F \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E";
  if (resetAt <= now)
    return "\u043E\u0436\u0438\u0434\u0430\u0435\u043C \u0441\u0431\u0440\u043E\u0441";
  const minutes = Math.floor((resetAt - now) / 60000);
  if (minutes < 1)
    return "< 1\u043C";
  if (minutes < 60)
    return `${minutes}\u043C`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)
    return `${hours}\u0447 ${minutes % 60}\u043C`;
  return `${Math.floor(hours / 24)}\u0434 ${hours % 24}\u0447`;
}

// src/panel.tsx
var percent = (value) => `${Math.round(value * 10) / 10}%`;
var exactTime = (value) => new Date(value).toLocaleString("ru-RU", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit"
});
var planName = (plan) => ({
  prolite: "Pro Lite",
  pro: "Pro",
  plus: "Plus",
  team: "Team",
  business: "Business",
  enterprise: "Enterprise",
  free: "Free"
})[plan ?? ""] ?? plan;
function UsagePanel(props) {
  const [width, setWidth] = createSignal(28);
  const usage = () => props.snapshot?.usage;
  const stale = () => props.snapshot?.state === "stale" || props.snapshot?.updatedAt !== undefined && props.now - props.snapshot.updatedAt > 120000;
  const color = (used) => used >= 95 ? props.colors.error : used >= 80 ? props.colors.warning : props.colors.accent;
  const Metrics = (p) => [_$createComponent(Show, {
    get when() {
      return p.credits?.balance !== undefined;
    },
    get children() {
      var _el$ = _$createElement("text"), _el$2 = _$createTextNode(`\u041A\u0440\u0435\u0434\u0438\u0442\u044B: `);
      _$insertNode(_el$, _el$2);
      _$insert(_el$, () => p.credits.balance, null);
      _$effect((_$p) => _$setProp(_el$, "fg", props.colors.muted, _$p));
      return _el$;
    }
  }), _$createComponent(Show, {
    get when() {
      return p.credits?.unlimited !== undefined;
    },
    get children() {
      var _el$3 = _$createElement("text"), _el$4 = _$createTextNode(`\u0411\u0435\u0437\u043B\u0438\u043C\u0438\u0442\u043D\u044B\u0435 \u043A\u0440\u0435\u0434\u0438\u0442\u044B: `);
      _$insertNode(_el$3, _el$4);
      _$insert(_el$3, () => p.credits?.unlimited ? "\u0434\u0430" : "\u043D\u0435\u0442", null);
      _$effect((_$p) => _$setProp(_el$3, "fg", props.colors.muted, _$p));
      return _el$3;
    }
  }), _$createComponent(Show, {
    get when() {
      return p.credits?.hasCredits !== undefined;
    },
    get children() {
      var _el$5 = _$createElement("text"), _el$6 = _$createTextNode(`\u041A\u0440\u0435\u0434\u0438\u0442\u044B \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B: `);
      _$insertNode(_el$5, _el$6);
      _$insert(_el$5, () => p.credits?.hasCredits ? "\u0434\u0430" : "\u043D\u0435\u0442", null);
      _$effect((_$p) => _$setProp(_el$5, "fg", props.colors.muted, _$p));
      return _el$5;
    }
  }), _$createComponent(Show, {
    get when() {
      return p.budget?.limit !== undefined;
    },
    get children() {
      var _el$7 = _$createElement("text"), _el$8 = _$createTextNode(`\u0411\u044E\u0434\u0436\u0435\u0442: `), _el$9 = _$createTextNode(` \u043A\u0440\u0435\u0434\u0438\u0442\u043E\u0432`);
      _$insertNode(_el$7, _el$8);
      _$insertNode(_el$7, _el$9);
      _$insert(_el$7, () => p.budget.limit, _el$9);
      _$effect((_$p) => _$setProp(_el$7, "fg", props.colors.muted, _$p));
      return _el$7;
    }
  }), _$createComponent(Show, {
    get when() {
      return p.budget?.used !== undefined;
    },
    get children() {
      var _el$0 = _$createElement("text"), _el$1 = _$createTextNode(`\u041F\u043E\u0442\u0440\u0430\u0447\u0435\u043D\u043E: `), _el$10 = _$createTextNode(` \u043A\u0440\u0435\u0434\u0438\u0442\u043E\u0432`);
      _$insertNode(_el$0, _el$1);
      _$insertNode(_el$0, _el$10);
      _$insert(_el$0, () => p.budget.used, _el$10);
      _$effect((_$p) => _$setProp(_el$0, "fg", props.colors.muted, _$p));
      return _el$0;
    }
  }), _$createComponent(Show, {
    get when() {
      return p.budget?.remainingPercent !== undefined;
    },
    get children() {
      var _el$11 = _$createElement("text"), _el$12 = _$createTextNode(`\u0411\u044E\u0434\u0436\u0435\u0442: `), _el$13 = _$createTextNode(` \u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C`);
      _$insertNode(_el$11, _el$12);
      _$insertNode(_el$11, _el$13);
      _$insert(_el$11, () => percent(p.budget.remainingPercent), _el$13);
      _$effect((_$p) => _$setProp(_el$11, "fg", props.colors.muted, _$p));
      return _el$11;
    }
  }), _$createComponent(Show, {
    get when() {
      return p.budget?.resetAt !== undefined;
    },
    get children() {
      var _el$14 = _$createElement("text"), _el$15 = _$createTextNode(`\u0421\u0431\u0440\u043E\u0441 \u0431\u044E\u0434\u0436\u0435\u0442\u0430: `);
      _$insertNode(_el$14, _el$15);
      _$insert(_el$14, () => exactTime(p.budget.resetAt), null);
      _$effect((_$p) => _$setProp(_el$14, "fg", props.colors.muted, _$p));
      return _el$14;
    }
  })];
  const Meter = (p) => {
    const bar = () => progress(p.window.used, Math.max(1, Math.min(28, width())));
    return (() => {
      var _el$16 = _$createElement("box"), _el$17 = _$createElement("text"), _el$18 = _$createElement("text"), _el$19 = _$createElement("b"), _el$20 = _$createTextNode(` \u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C`), _el$21 = _$createElement("text"), _el$22 = _$createElement("span"), _el$23 = _$createElement("span"), _el$24 = _$createElement("text"), _el$25 = _$createTextNode(` \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u043E`), _el$26 = _$createElement("text"), _el$27 = _$createTextNode(`\u0421\u0431\u0440\u043E\u0441: `);
      _$insertNode(_el$16, _el$17);
      _$insertNode(_el$16, _el$18);
      _$insertNode(_el$16, _el$21);
      _$insertNode(_el$16, _el$24);
      _$insertNode(_el$16, _el$26);
      _$setProp(_el$16, "flexDirection", "column");
      _$setProp(_el$16, "marginTop", 1);
      _$setProp(_el$16, "flexShrink", 0);
      _$insert(_el$17, () => p.window.label);
      _$insertNode(_el$18, _el$19);
      _$insertNode(_el$19, _el$20);
      _$insert(_el$19, () => percent(100 - p.window.used), _el$20);
      _$insertNode(_el$21, _el$22);
      _$insertNode(_el$21, _el$23);
      _$setProp(_el$21, "wrapMode", "none");
      _$insert(_el$22, () => bar().filled);
      _$insert(_el$23, () => bar().empty);
      _$insertNode(_el$24, _el$25);
      _$insert(_el$24, () => percent(p.window.used), _el$25);
      _$insertNode(_el$26, _el$27);
      _$insert(_el$26, () => remainingTime(p.window.resetAt, props.now), null);
      _$insert(_el$16, _$createComponent(Show, {
        get when() {
          return _$memo(() => !!props.expanded)() && p.window.resetAt !== undefined;
        },
        get children() {
          var _el$28 = _$createElement("text");
          _$insert(_el$28, () => exactTime(p.window.resetAt));
          _$effect((_$p) => _$setProp(_el$28, "fg", props.colors.muted, _$p));
          return _el$28;
        }
      }), null);
      _$effect((_p$) => {
        var _v$ = props.colors.text, _v$2 = p.window.used >= 80 ? color(p.window.used) : props.colors.success, _v$3 = {
          fg: color(p.window.used)
        }, _v$4 = {
          fg: props.colors.faint
        }, _v$5 = props.colors.muted, _v$6 = props.colors.muted;
        _v$ !== _p$.e && (_p$.e = _$setProp(_el$17, "fg", _v$, _p$.e));
        _v$2 !== _p$.t && (_p$.t = _$setProp(_el$18, "fg", _v$2, _p$.t));
        _v$3 !== _p$.a && (_p$.a = _$setProp(_el$22, "style", _v$3, _p$.a));
        _v$4 !== _p$.o && (_p$.o = _$setProp(_el$23, "style", _v$4, _p$.o));
        _v$5 !== _p$.i && (_p$.i = _$setProp(_el$24, "fg", _v$5, _p$.i));
        _v$6 !== _p$.n && (_p$.n = _$setProp(_el$26, "fg", _v$6, _p$.n));
        return _p$;
      }, {
        e: undefined,
        t: undefined,
        a: undefined,
        o: undefined,
        i: undefined,
        n: undefined
      });
      return _el$16;
    })();
  };
  return (() => {
    var _el$29 = _$createElement("box"), _el$30 = _$createElement("text"), _el$31 = _$createElement("b"), _el$33 = _$createElement("text"), _el$34 = _$createElement("b"), _el$36 = _$createElement("span"), _el$37 = _$createElement("text"), _el$50 = _$createElement("text");
    _$insertNode(_el$29, _el$30);
    _$insertNode(_el$29, _el$33);
    _$insertNode(_el$29, _el$37);
    _$insertNode(_el$29, _el$50);
    _$setProp(_el$29, "flexDirection", "column");
    _$setProp(_el$29, "flexShrink", 0);
    _$setProp(_el$29, "marginTop", 1);
    _$setProp(_el$29, "onSizeChange", function() {
      setWidth(this.width);
    });
    _$insertNode(_el$30, _el$31);
    _$insertNode(_el$31, _$createTextNode(`Usage`));
    _$insertNode(_el$33, _el$34);
    _$insertNode(_el$33, _el$36);
    _$insertNode(_el$34, _$createTextNode(`OpenAI`));
    _$insert(_el$36, () => props.active ? " \u25CF" : "");
    _$insert(_el$37, () => [planName(usage()?.plan), "\u0447\u0435\u0440\u0435\u0437 Codex"].filter(Boolean).join(" \xB7 "));
    _$insert(_el$29, _$createComponent(Show, {
      get when() {
        return usage();
      },
      get fallback() {
        return (() => {
          var _el$51 = _$createElement("text");
          _$insert(_el$51, () => props.loading ? "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u043B\u0438\u043C\u0438\u0442\u044B\u2026" : "\u041D\u0435\u0442 \u0434\u0430\u043D\u043D\u044B\u0445");
          _$effect((_$p) => _$setProp(_el$51, "fg", props.colors.muted, _$p));
          return _el$51;
        })();
      },
      get children() {
        return [_$createComponent(For, {
          get each() {
            return usage()?.windows.filter((w) => !w.extra);
          },
          children: (window) => _$createComponent(Meter, {
            window
          })
        }), _$createComponent(Show, {
          get when() {
            return usage()?.allowed === false || usage()?.limitReached === true;
          },
          get children() {
            var _el$38 = _$createElement("text");
            _$insertNode(_el$38, _$createTextNode(`\u041B\u0438\u043C\u0438\u0442 \u0438\u0441\u0447\u0435\u0440\u043F\u0430\u043D`));
            _$effect((_$p) => _$setProp(_el$38, "fg", props.colors.error, _$p));
            return _el$38;
          }
        }), _$createComponent(Show, {
          get when() {
            return props.expanded;
          },
          get children() {
            return [_$createComponent(For, {
              get each() {
                return usage()?.windows.filter((w) => w.extra);
              },
              children: (window) => _$createComponent(Meter, {
                window
              })
            }), (() => {
              var _el$40 = _$createElement("box");
              _$setProp(_el$40, "marginTop", 1);
              _$setProp(_el$40, "flexDirection", "column");
              _$setProp(_el$40, "flexShrink", 0);
              _$insert(_el$40, _$createComponent(Show, {
                get when() {
                  return props.snapshot?.account;
                },
                get children() {
                  var _el$41 = _$createElement("text");
                  _$insert(_el$41, () => props.snapshot.account);
                  _$effect((_$p) => _$setProp(_el$41, "fg", props.colors.muted, _$p));
                  return _el$41;
                }
              }), null);
              _$insert(_el$40, _$createComponent(Metrics, {
                get credits() {
                  return usage()?.credits;
                },
                get budget() {
                  return usage()?.budget;
                }
              }), null);
              _$insert(_el$40, _$createComponent(For, {
                get each() {
                  return usage()?.buckets;
                },
                children: (bucket) => (() => {
                  var _el$52 = _$createElement("box"), _el$53 = _$createElement("text");
                  _$insertNode(_el$52, _el$53);
                  _$setProp(_el$52, "flexDirection", "column");
                  _$setProp(_el$52, "flexShrink", 0);
                  _$setProp(_el$52, "marginTop", 1);
                  _$insert(_el$53, () => bucket.label);
                  _$insert(_el$52, _$createComponent(Metrics, {
                    get credits() {
                      return bucket.credits;
                    },
                    get budget() {
                      return bucket.budget;
                    }
                  }), null);
                  _$effect((_$p) => _$setProp(_el$53, "fg", props.colors.text, _$p));
                  return _el$52;
                })()
              }), null);
              _$insert(_el$40, _$createComponent(Show, {
                get when() {
                  return usage()?.allowed !== undefined;
                },
                get children() {
                  var _el$42 = _$createElement("text"), _el$43 = _$createTextNode(`\u0417\u0430\u043F\u0440\u043E\u0441\u044B \u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043D\u044B: `);
                  _$insertNode(_el$42, _el$43);
                  _$insert(_el$42, () => usage()?.allowed ? "\u0434\u0430" : "\u043D\u0435\u0442", null);
                  _$effect((_$p) => _$setProp(_el$42, "fg", props.colors.muted, _$p));
                  return _el$42;
                }
              }), null);
              _$insert(_el$40, _$createComponent(For, {
                get each() {
                  return usage()?.details;
                },
                children: (detail) => (() => {
                  var _el$54 = _$createElement("text"), _el$55 = _$createTextNode(`: `);
                  _$insertNode(_el$54, _el$55);
                  _$insert(_el$54, () => detail.label, _el$55);
                  _$insert(_el$54, () => detail.value, null);
                  _$effect((_$p) => _$setProp(_el$54, "fg", props.colors.muted, _$p));
                  return _el$54;
                })()
              }), null);
              _$insert(_el$40, _$createComponent(Show, {
                get when() {
                  return usage()?.resetCredits;
                },
                get children() {
                  return [(() => {
                    var _el$44 = _$createElement("text"), _el$45 = _$createTextNode(`\u0421\u0431\u0440\u043E\u0441\u044B \u043B\u0438\u043C\u0438\u0442\u0430: `);
                    _$insertNode(_el$44, _el$45);
                    _$insert(_el$44, () => usage().resetCredits.available, null);
                    _$effect((_$p) => _$setProp(_el$44, "fg", props.colors.muted, _$p));
                    return _el$44;
                  })(), _$createComponent(For, {
                    get each() {
                      return usage()?.resetCredits?.items;
                    },
                    children: (item) => (() => {
                      var _el$56 = _$createElement("text"), _el$57 = _$createTextNode(` \xB7 `);
                      _$insertNode(_el$56, _el$57);
                      _$insert(_el$56, () => item.title ?? "\u0421\u0431\u0440\u043E\u0441", _el$57);
                      _$insert(_el$56, (() => {
                        var _c$2 = _$memo(() => item.status === "available");
                        return () => _c$2() ? "\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D" : item.status ?? "\u2014";
                      })(), null);
                      _$insert(_el$56, (() => {
                        var _c$3 = _$memo(() => !!item.expiresAt);
                        return () => _c$3() ? ` \xB7 \u0434\u043E ${exactTime(item.expiresAt)}` : "";
                      })(), null);
                      _$effect((_$p) => _$setProp(_el$56, "fg", props.colors.muted, _$p));
                      return _el$56;
                    })()
                  })];
                }
              }), null);
              return _el$40;
            })()];
          }
        }), (() => {
          var _el$46 = _$createElement("text");
          _$setProp(_el$46, "marginTop", 1);
          _$insert(_el$46, () => props.expanded ? "\u25BE \u0421\u043A\u0440\u044B\u0442\u044C \u043F\u043E\u0434\u0440\u043E\u0431\u043D\u043E\u0441\u0442\u0438" : "\u25B8 \u0414\u0430\u043D\u043D\u044B\u0435 \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0430");
          _$effect((_p$) => {
            var _v$7 = props.colors.accent, _v$8 = props.toggle;
            _v$7 !== _p$.e && (_p$.e = _$setProp(_el$46, "fg", _v$7, _p$.e));
            _v$8 !== _p$.t && (_p$.t = _$setProp(_el$46, "onMouseDown", _v$8, _p$.t));
            return _p$;
          }, {
            e: undefined,
            t: undefined
          });
          return _el$46;
        })()];
      }
    }), _el$50);
    _$insert(_el$29, _$createComponent(Show, {
      get when() {
        return stale();
      },
      get children() {
        var _el$47 = _$createElement("text");
        _$insertNode(_el$47, _$createTextNode(`\u0414\u0430\u043D\u043D\u044B\u0435 \u0443\u0441\u0442\u0430\u0440\u0435\u043B\u0438`));
        _$effect((_$p) => _$setProp(_el$47, "fg", props.colors.warning, _$p));
        return _el$47;
      }
    }), _el$50);
    _$insert(_el$29, _$createComponent(Show, {
      get when() {
        return props.snapshot?.message;
      },
      get children() {
        var _el$49 = _$createElement("text");
        _$insert(_el$49, () => props.snapshot.message);
        _$effect((_$p) => _$setProp(_el$49, "fg", props.colors.warning, _$p));
        return _el$49;
      }
    }), _el$50);
    _$setProp(_el$50, "marginTop", 1);
    _$insert(_el$50, (() => {
      var _c$ = _$memo(() => !!props.loading);
      return () => _c$() ? "\u041E\u0431\u043D\u043E\u0432\u043B\u044F\u0435\u043C\u2026" : _$memo(() => props.snapshot?.updatedAt === undefined)() ? "\u21BB \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C" : `\u21BB ${Math.max(0, Math.floor((props.now - props.snapshot.updatedAt) / 60000))}\u043C \u043D\u0430\u0437\u0430\u0434 \xB7 \u043A\u0430\u0436\u0434\u044B\u0435 60\u0441`;
    })());
    _$effect((_p$) => {
      var _v$9 = props.colors.text, _v$0 = props.colors.text, _v$1 = {
        fg: props.colors.accent
      }, _v$10 = props.colors.muted, _v$11 = props.colors.muted, _v$12 = props.refresh;
      _v$9 !== _p$.e && (_p$.e = _$setProp(_el$30, "fg", _v$9, _p$.e));
      _v$0 !== _p$.t && (_p$.t = _$setProp(_el$33, "fg", _v$0, _p$.t));
      _v$1 !== _p$.a && (_p$.a = _$setProp(_el$36, "style", _v$1, _p$.a));
      _v$10 !== _p$.o && (_p$.o = _$setProp(_el$37, "fg", _v$10, _p$.o));
      _v$11 !== _p$.i && (_p$.i = _$setProp(_el$50, "fg", _v$11, _p$.i));
      _v$12 !== _p$.n && (_p$.n = _$setProp(_el$50, "onMouseDown", _v$12, _p$.n));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined,
      o: undefined,
      i: undefined,
      n: undefined
    });
    return _el$29;
  })();
}

// src/tui.tsx
var tui_default = Plugin.define({
  id: "openai-usage.tui",
  setup(context) {
    const [expanded, setExpanded] = createSignal2(false);
    const toggle = () => {
      setExpanded((value) => !value);
    };
    return context.ui.slot({
      append: "sidebar.content",
      render: () => {
        const [snapshot, setSnapshot] = createSignal2();
        const [now, setNow] = createSignal2(Date.now());
        const [loading, setLoading] = createSignal2(false);
        let disposed = false;
        let request;
        async function refresh() {
          if (loading() || disposed)
            return;
          setLoading(true);
          request = new AbortController;
          try {
            const result = await context.client.rpc(OpenAIUsage).get({}, {
              location: context.location ?? context.data.location.default(),
              signal: AbortSignal.any([request.signal, AbortSignal.timeout(20000)])
            });
            if (!disposed)
              setSnapshot(result);
          } catch {
            if (!disposed)
              setSnapshot((previous) => ({
                ...previous,
                state: previous?.usage ? "stale" : "unavailable",
                checkedAt: Date.now(),
                message: "\u041D\u0435\u0442 \u0441\u0432\u044F\u0437\u0438 \u0441 \u0441\u0435\u0440\u0432\u0435\u0440\u043E\u043C OpenCode"
              }));
          } finally {
            request = undefined;
            if (!disposed) {
              setLoading(false);
              setNow(Date.now());
            }
          }
        }
        onMount(() => {
          refresh();
          const poll = setInterval(() => void refresh(), 60000);
          const clock = setInterval(() => setNow(Date.now()), 1e4);
          onCleanup(() => {
            disposed = true;
            request?.abort();
            clearInterval(poll);
            clearInterval(clock);
          });
        });
        context.keymap.layer(() => ({
          mode: "global",
          commands: [{
            id: "openai-usage.details",
            title: "OpenAI Usage: \u043F\u043E\u0434\u0440\u043E\u0431\u043D\u043E\u0441\u0442\u0438",
            group: "Usage",
            palette: true,
            slash: {
              name: "usage"
            },
            run: toggle
          }, {
            id: "openai-usage.refresh",
            title: "OpenAI Usage: \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u044C",
            group: "Usage",
            palette: true,
            run: refresh
          }]
        }));
        return _$createComponent2(UsagePanel, {
          get snapshot() {
            return snapshot();
          },
          get now() {
            return now();
          },
          get expanded() {
            return expanded();
          },
          toggle,
          refresh: () => void refresh(),
          get loading() {
            return loading();
          },
          get active() {
            return context.ui.model.current()?.providerID === "openai";
          },
          get colors() {
            return {
              text: context.theme.text.base,
              muted: context.theme.text.muted,
              faint: context.theme.text.faint,
              accent: context.theme.text.action.primary.base,
              success: context.theme.text.feedback.success.base,
              warning: context.theme.text.feedback.warning.base,
              error: context.theme.text.feedback.error.base
            };
          }
        });
      }
    });
  }
});
export {
  tui_default as default
};
