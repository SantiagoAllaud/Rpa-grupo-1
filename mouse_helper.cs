using System;
using System.Diagnostics;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

public class MouseHelper {
    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();

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

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, System.Text.StringBuilder lpClassName, int nMaxCount);

    public const int MOUSEEVENTF_LEFTDOWN = 0x02;
    public const int MOUSEEVENTF_LEFTUP = 0x04;
    public const int MOUSEEVENTF_RIGHTDOWN = 0x08;
    public const int MOUSEEVENTF_RIGHTUP = 0x10;
    public const int MOUSEEVENTF_WHEEL = 0x0800;

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

    public static POINT GetPosition() {
        POINT p;
        GetCursorPos(out p);
        return p;
    }

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

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
                Thread.Sleep(180);
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

        int steps = Math.Max((int)(durationMs / 12), 18);
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

    // Clic humano visible con pausa realista entre down y up
    public static void Click(int? x, int? y, int durationMs = 400) {
        if (x.HasValue && y.HasValue) {
            MoveSmooth(x.Value, y.Value, durationMs);
        }
        Thread.Sleep(100);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
        Thread.Sleep(110);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
        Thread.Sleep(120);
    }

    // Convierte coordenadas CSS del viewport al escritorio físico. Puppeteer sólo
    // lee la posición; el movimiento y el click se realizan con Win32 reales.
    public static POINT ViewportToScreen(int x, int y, int outerWidth, int outerHeight, int innerWidth, int innerHeight) {
        IntPtr hwnd = GetChromeHwnd();
        RECT rect;
        if (hwnd == IntPtr.Zero || !GetWindowRect(hwnd, out rect)) return new POINT { X = x, Y = y };

        double windowWidth = Math.Max(1, rect.Right - rect.Left);
        double scale = outerWidth > 0 ? windowWidth / outerWidth : 1.0;
        double contentWidth = Math.Max(1, innerWidth * scale);
        double contentHeight = Math.Max(1, innerHeight * scale);
        double contentLeft = rect.Left + Math.Max(0, (windowWidth - contentWidth) / 2.0);
        double contentTop = rect.Bottom - contentHeight;
        return new POINT {
            X = (int)Math.Round(contentLeft + x * scale),
            Y = (int)Math.Round(contentTop + y * scale)
        };
    }

    public static void MoveViewport(int x, int y, int outerWidth, int outerHeight, int innerWidth, int innerHeight, int durationMs) {
        FocusChrome();
        POINT screenPoint = ViewportToScreen(x, y, outerWidth, outerHeight, innerWidth, innerHeight);
        MoveSmooth(screenPoint.X, screenPoint.Y, durationMs);
    }

    public static void ClickViewport(int x, int y, int outerWidth, int outerHeight, int innerWidth, int innerHeight, int durationMs) {
        MoveViewport(x, y, outerWidth, outerHeight, innerWidth, innerHeight, durationMs);
        Click(null, null, 0);
    }

    // pixels positivos representan un desplazamiento hacia abajo, como la rueda.
    public static void ScrollVisible(int pixels, int steps, int delayMs) {
        FocusChrome();
        int count = Math.Max(1, Math.Abs(pixels) / Math.Max(1, steps * 90));
        int direction = pixels >= 0 ? -120 : 120;
        for (int i = 0; i < count; i++) {
            mouse_event(MOUSEEVENTF_WHEEL, 0, 0, direction, 0);
            Thread.Sleep(Math.Max(delayMs, 40));
        }
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

    // Escritura progresiva letra por letra visible
    public static void TypeText(string text, int charDelayMs) {
        if (string.IsNullOrEmpty(text)) return;
        foreach (char c in text) {
            string s = c.ToString();
            try {
                if (char.IsLetterOrDigit(c) || c == ' ' || c == '.' || c == '/' || c == '-' || c == ':' || c == '_' || c == '?') {
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
            Thread.Sleep(Math.Max(charDelayMs, 15));
        }
    }

    // Navegación 100% VISIBLE por la barra de direcciones de Chrome:
    // Mueve el cursor a la barra de direcciones -> Selecciona con Alt+D -> Tipea URL carácter por carácter -> Enter
    public static void NavigateOmnibox(string url, int typingDelayMs) {
        FocusChrome();
        Thread.Sleep(150);

        IntPtr hwnd = GetChromeHwnd();
        int targetX = 500;
        int targetY = 55;

        if (hwnd != IntPtr.Zero) {
            RECT rect;
            GetWindowRect(hwnd, out rect);
            targetX = rect.Left + Math.Min(550, Math.Max(350, (rect.Right - rect.Left) / 2));
            targetY = Math.Max(50, rect.Top + 55);
        }

        // 1. Mover el cursor físico hacia la barra de direcciones
        MoveSmooth(targetX, targetY, 450);
        Thread.Sleep(100);

        // 2. Enfocar y seleccionar la barra de direcciones con Alt+D (atajo universal de Chrome)
        try {
            SendKeys.SendWait("%d");
            Thread.Sleep(150);
        } catch {}

        // Click suave en la barra para asegurar foco visual
        Click(targetX, targetY, 150);
        Thread.Sleep(150);

        // 3. Tipeo progresivo de la URL
        TypeText(url, typingDelayMs);
        Thread.Sleep(200);

        // 4. Presionar Enter para iniciar la navegación
        try {
            SendKeys.SendWait("{ENTER}");
        } catch {}
    }

    [STAThread]
    public static void Main(string[] args) {
        try {
            SetProcessDPIAware();
        } catch {}

        if (args.Length == 0) {
            Console.WriteLine("MouseHelper v2.0 - Windows Native Cursor & Automation Controller");
            Console.WriteLine("Usage: mouse_helper <cmd> [args...]");
            Console.WriteLine("Commands:");
            Console.WriteLine("  pos                           -> prints current x,y");
            Console.WriteLine("  move <x> <y> [ms]             -> moves cursor smoothly");
            Console.WriteLine("  click [x y] [ms]              -> clicks at current or target position");
            Console.WriteLine("  moveviewport <x> <y> <outerW> <outerH> <innerW> <innerH> [ms]");
            Console.WriteLine("  clickviewport <x> <y> <outerW> <outerH> <innerW> <innerH> [ms]");
            Console.WriteLine("  scroll <pixels> [steps] [ms]  -> native wheel scroll (positive = down)");
            Console.WriteLine("  drag <x1> <y1> <x2> <y2> [ms] -> drag & drop");
            Console.WriteLine("  type <text> [charDelayMs]     -> types progressive text");
            Console.WriteLine("  key <keys>                    -> sends special keys (e.g. {ENTER})");
            Console.WriteLine("  nav <url> [charDelayMs]       -> visible move to omnibox, clicks, types url, hits Enter");
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
                case "moveviewport": {
                    int ms = args.Length > 7 ? int.Parse(args[7]) : 500;
                    MoveViewport(int.Parse(args[1]), int.Parse(args[2]), int.Parse(args[3]), int.Parse(args[4]), int.Parse(args[5]), int.Parse(args[6]), ms);
                    Console.WriteLine("OK");
                    break;
                }
                case "clickviewport": {
                    int ms = args.Length > 7 ? int.Parse(args[7]) : 0;
                    ClickViewport(int.Parse(args[1]), int.Parse(args[2]), int.Parse(args[3]), int.Parse(args[4]), int.Parse(args[5]), int.Parse(args[6]), ms);
                    Console.WriteLine("OK");
                    break;
                }
                case "scroll": {
                    int steps = args.Length > 2 ? int.Parse(args[2]) : 1;
                    int delay = args.Length > 3 ? int.Parse(args[3]) : 100;
                    ScrollVisible(int.Parse(args[1]), steps, delay);
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
