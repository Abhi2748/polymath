"""Drawing helpers used for the hand-written model lessons.

A starting point for pipeline/visuals.py. Every drawing is 320 by 180, uses currentColor for ink
and the --accent variable for emphasis, and keeps its labels short and inside the frame.
"""

ACC = "var(--accent, #3b82f6)"
INK = "currentColor"


def svg(body, alt):
    return {"kind": "svg", "alt": alt,
            "svg": f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" role="img" font-family="inherit">{body}</svg>'}


def text(x, y, s, size=13, anchor="middle", fill=INK, weight="400"):
    return f'<text x="{x}" y="{y}" font-size="{size}" text-anchor="{anchor}" fill="{fill}" font-weight="{weight}">{s}</text>'


def rect(x, y, w, h, fill="none", stroke=INK, sw=2, rx=6, opacity=None):
    o = f' opacity="{opacity}"' if opacity is not None else ""
    s = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}"{s}{o}/>'


def line(d, stroke=INK, sw=2, dash=None, opacity=None):
    extra = (f' stroke-dasharray="{dash}"' if dash else "") + (f' opacity="{opacity}"' if opacity is not None else "")
    return f'<path d="{d}" fill="none" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"{extra}/>'


def arrow(x1, y1, x2, y2, stroke=INK, sw=2):
    """A straight arrow with a small head. Horizontal or vertical only."""
    if y1 == y2:
        s = 1 if x2 > x1 else -1
        head = f"M{x2} {y2}l{-7 * s} -5M{x2} {y2}l{-7 * s} 5"
    else:
        s = 1 if y2 > y1 else -1
        head = f"M{x2} {y2}l-5 {-7 * s}M{x2} {y2}l5 {-7 * s}"
    return line(f"M{x1} {y1}L{x2} {y2}{head}", stroke, sw)


def circle(cx, cy, r, fill="none", stroke=INK, sw=2, opacity=None):
    o = f' opacity="{opacity}"' if opacity is not None else ""
    s = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}"{s}{o}/>'


def chart(kind, x_label, y_label, series, alt, caption=None):
    v = {"kind": "chart", "alt": alt, "chart": {"type": kind, "x_label": x_label, "y_label": y_label, "series": series}}
    if caption:
        v["caption"] = caption
    return v
