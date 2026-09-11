using System;
using System.Diagnostics;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

public class MouseHelper {
    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    public static extern bool GetCursorPos(out POINT lpPoint);

    [DllImport("user32.dll")]
    public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    public const int MOUSEEVENTF_LEFTDOWN = 0x02;
    public const int MOUSEEVENTF_LEFTUP = 0x04;
    public const int MOUSEEVENTF_RIGHTDOWN = 0x08;
    public const int MOUSEEVENTF_RIGHTUP = 0x10;

    public const int SW_RESTORE = 9;

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT {
        public int X;
        public int Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    public static POINT GetPosition() {
        POINT p;
        GetCursorPos(out p);
        return p;
    }

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, System.Text.StringBuilder lpClassName, int nMaxCount);

    public static IntPtr GetChromeHwnd() {
        IntPtr found = IntPtr.Zero;
        try {
            EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
                if (IsWindowVisible(hWnd)) {
                    System.Text.StringBuilder sb = new System.Text.StringBuilder(256);
                    GetClassName(hWnd, sb, sb.Capacity);
                    if (sb.ToString() == "Chrome_WidgetWin_1") {
                        found = hWnd;
                        return false;
                    }
                }
                return true;
            }, IntPtr.Zero);
        } catch {}
        return found;
    }

    public static bool FocusChrome() {
        try {
            IntPtr hwnd = GetChromeHwnd();
            if (hwnd != IntPtr.Zero) {
                ShowWindow(hwnd, SW_RESTORE);
                SetForegroundWindow(hwnd);
                Thread.Sleep(150);
                return true;
            }
        } catch {}
        return false;
    }

    // Movimiento con curvas de Bézier cúbicas y aceleración/desaceleración humana
    public static void MoveSmooth(int targetX, int targetY, int durationMs) {
        POINT start = GetPosition();
        if (start.X == targetX && start.Y == targetY) return;

        if (durationMs <= 30) {
            SetCursorPos(targetX, targetY);
            return;
        }

        Random rnd = new Random();
        double distance = Math.Sqrt(Math.Pow(targetX - start.X, 2) + Math.Pow(targetY - start.Y, 2));
        double deviation = Math.Min(distance * 0.25, 120.0);

        // Control points para curva cúbica de Bézier
        double cp1X = start.X + (targetX - start.X) * 0.25 + (rnd.NextDouble() - 0.5) * deviation;
        double cp1Y = start.Y + (targetY - start.Y) * 0.25 + (rnd.NextDouble() - 0.5) * deviation;
        double cp2X = start.X + (targetX - start.X) * 0.75 + (rnd.NextDouble() - 0.5) * deviation;
        double cp2Y = start.Y + (targetY - start.Y) * 0.75 + (rnd.NextDouble() - 0.5) * deviation;

        int steps = Math.Max((int)(durationMs / 12), 15);
        int sleepPerStep = Math.Max(durationMs / steps, 8);

        for (int i = 1; i <= steps; i++) {
            double tLinear = (double)i / steps;
            // Easing cúbico ease-in-out para movimiento natural
            double t = tLinear < 0.5 
                ? 4.0 * tLinear * tLinear * tLinear 
                : 1.0 - Math.Pow(-2.0 * tLinear + 2.0, 3.0) / 2.0;

            double u = 1.0 - t;
            double tt = t * t;
            double uu = u * u;
            double uuu = uu * u;
            double ttt = tt * t;

            double px = uuu * start.X + 3 * uu * t * cp1X + 3 * u * tt * cp2X + ttt * targetX;
            double py = uuu * start.Y + 3 * uu * t * cp1Y + 3 * u * tt * cp2Y + ttt * targetY;

            SetCursorPos((int)Math.Round(px), (int)Math.Round(py));
            Thread.Sleep(sleepPerStep);
        }

        SetCursorPos(targetX, targetY);
        Thread.Sleep(50);
    }

    // Clic humano visible con pequeña pausa entre down y up
    public static void Click(int? x, int? y, int durationMs = 400) {
        if (x.HasValue && y.HasValue) {
            MoveSmooth(x.Value, y.Value, durationMs);
        }
        Thread.Sleep(80);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
        Thread.Sleep(90);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
        Thread.Sleep(100);
    }

    // Arrastre fluido de sliders y rangos
    public static void Drag(int x1, int y1, int x2, int y2, int durationMs) {
        MoveSmooth(x1, y1, 400);
        Thread.Sleep(120);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
        Thread.Sleep(150);
        MoveSmooth(x2, y2, durationMs);
        Thread.Sleep(150);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
        Thread.Sleep(120);
    }

    // Escritura progresiva letra por letra
    public static void TypeText(string text, int charDelayMs) {
        if (string.IsNullOrEmpty(text)) return;
        foreach (char c in text) {
            string s = c.ToString();
            try {
                if (char.IsLetterOrDigit(c) || c == ' ') {
                    SendKeys.SendWait(s);
                } else if (s == "{" || s == "}" || s == "(" || s == ")" || s == "+" || s == "^" || s == "%" || s == "~") {
                    SendKeys.SendWait("{" + s + "}");
                } else {
                    Clipboard.SetText(s);
                    SendKeys.SendWait("^v");
                }
            } catch {
                try {
                    Clipboard.SetText(s);
                    SendKeys.SendWait("^v");
                } catch {}
            }
            Thread.Sleep(Math.Max(charDelayMs, 10));
        }
    }

    // Navegación visible por la barra de direcciones de Chrome (sin mover el mouse físico del usuario)
    public static void NavigateOmnibox(string url, int typingDelayMs) {
        FocusChrome();
        Thread.Sleep(250);

        // Seleccionar todo garantizando enfoque del Omnibox con Ctrl+L
        try {
            SendKeys.SendWait("^l");
            Thread.Sleep(150);
            SendKeys.SendWait("{BACKSPACE}");
            Thread.Sleep(120);
        } catch {}

        // Escritura progresiva de la URL
        TypeText(url, typingDelayMs);
        Thread.Sleep(250);

        // Presionar Enter
        try {
            SendKeys.SendWait("{ENTER}");
        } catch {}
    }

    [STAThread]
    public static void Main(string[] args) {
        if (args.Length == 0) {
            Console.WriteLine("MouseHelper v1.0 - Windows Native Cursor Controller");
            Console.WriteLine("Usage: mouse_helper <cmd> [args...]");
            Console.WriteLine("Commands:");
            Console.WriteLine("  pos                           -> prints current x,y");
            Console.WriteLine("  move <x> <y> [ms]             -> moves cursor smoothly");
            Console.WriteLine("  click [x y] [ms]              -> clicks at current or target position");
            Console.WriteLine("  drag <x1> <y1> <x2> <y2> [ms] -> drag & drop");
            Console.WriteLine("  type <text> [charDelayMs]     -> types progressive text");
            Console.WriteLine("  key <keys>                    -> sends special keys (e.g. {ENTER})");
            Console.WriteLine("  nav <url> [charDelayMs]       -> focus Chrome omnibox, types url, hits Enter");
            Console.WriteLine("  focus                         -> brings Chrome to front");
            return;
        }

        string cmd = args[0].ToLowerInvariant();

        try {
            switch (cmd) {
                case "pos": {
                    POINT p = GetPosition();
                    Console.WriteLine(p.X + "," + p.Y);
                    break;
                }
                case "move": {
                    int x = int.Parse(args[1]);
                    int y = int.Parse(args[2]);
                    int ms = args.Length > 3 ? int.Parse(args[3]) : 500;
                    MoveSmooth(x, y, ms);
                    Console.WriteLine("OK");
                    break;
                }
                case "click": {
                    if (args.Length >= 3) {
                        int x = int.Parse(args[1]);
                        int y = int.Parse(args[2]);
                        int ms = args.Length > 3 ? int.Parse(args[3]) : 400;
                        Click(x, y, ms);
                    } else {
                        Click(null, null);
                    }
                    Console.WriteLine("OK");
                    break;
                }
                case "drag": {
                    int x1 = int.Parse(args[1]);
                    int y1 = int.Parse(args[2]);
                    int x2 = int.Parse(args[3]);
                    int y2 = int.Parse(args[4]);
                    int ms = args.Length > 5 ? int.Parse(args[5]) : 600;
                    Drag(x1, y1, x2, y2, ms);
                    Console.WriteLine("OK");
                    break;
                }
                case "type": {
                    string text = args[1];
                    int delay = args.Length > 2 ? int.Parse(args[2]) : 50;
                    TypeText(text, delay);
                    Console.WriteLine("OK");
                    break;
                }
                case "key": {
                    string keys = args[1];
                    SendKeys.SendWait(keys);
                    Console.WriteLine("OK");
                    break;
                }
                case "nav": {
                    string url = args[1];
                    int delay = args.Length > 2 ? int.Parse(args[2]) : 45;
                    NavigateOmnibox(url, delay);
                    Console.WriteLine("OK");
                    break;
                }
                case "focus": {
                    bool ok = FocusChrome();
                    Console.WriteLine(ok ? "OK" : "NOT_FOUND");
                    break;
                }
                default: {
                    Console.WriteLine("UNKNOWN_CMD");
                    break;
                }
            }
        } catch (Exception ex) {
            Console.Error.WriteLine("ERROR: " + ex.Message);
        }
    }
}
