#include "native_window.h"

#include <cstdio>

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <windowsx.h>

namespace native_window {

namespace {
constexpr const wchar_t* kClassName = L"BabylonLiteNativeHostWindow";
}

Window::Window() {}
Window::~Window() { destroy(); }

bool Window::create(int width, int height, const std::string& title) {
    hinstance_ = ::GetModuleHandleW(nullptr);

    WNDCLASSEXW wc{};
    wc.cbSize = sizeof(wc);
    wc.style = CS_HREDRAW | CS_VREDRAW | CS_OWNDC;
    wc.lpfnWndProc = (WNDPROC)&Window::wndProcThunk;
    wc.hInstance = (HINSTANCE)hinstance_;
    wc.hCursor = ::LoadCursor(nullptr, IDC_ARROW);
    wc.lpszClassName = kClassName;
    wc.hbrBackground = (HBRUSH)::GetStockObject(BLACK_BRUSH);
    ATOM atom = ::RegisterClassExW(&wc);
    if (!atom && ::GetLastError() != ERROR_CLASS_ALREADY_EXISTS) {
        std::fprintf(stderr, "[win] RegisterClassExW failed (%lu)\n", ::GetLastError());
        return false;
    }

    int wlen = ::MultiByteToWideChar(CP_UTF8, 0, title.data(), (int)title.size(), nullptr, 0);
    std::wstring wtitle(wlen, L'\0');
    ::MultiByteToWideChar(CP_UTF8, 0, title.data(), (int)title.size(), wtitle.data(), wlen);

    // Compute window rect so the *client* area is `width` x `height`.
    DWORD style = WS_OVERLAPPEDWINDOW;
    RECT rc{ 0, 0, width, height };
    ::AdjustWindowRect(&rc, style, FALSE);
    int winW = rc.right - rc.left;
    int winH = rc.bottom - rc.top;

    HWND hwnd = ::CreateWindowExW(
        0, kClassName, wtitle.c_str(), style,
        CW_USEDEFAULT, CW_USEDEFAULT, winW, winH,
        nullptr, nullptr, (HINSTANCE)hinstance_, this);
    if (!hwnd) {
        std::fprintf(stderr, "[win] CreateWindowExW failed (%lu)\n", ::GetLastError());
        return false;
    }
    hwnd_ = hwnd;
    ::ShowWindow(hwnd, SW_SHOW);
    ::UpdateWindow(hwnd);
    return true;
}

void Window::destroy() {
    if (hwnd_) {
        ::DestroyWindow((HWND)hwnd_);
        hwnd_ = nullptr;
    }
}

bool Window::pumpEvents() {
    MSG msg;
    while (::PeekMessageW(&msg, nullptr, 0, 0, PM_REMOVE)) {
        if (msg.message == WM_QUIT) {
            shouldClose_ = true;
            return false;
        }
        ::TranslateMessage(&msg);
        ::DispatchMessageW(&msg);
    }
    return !shouldClose_;
}

void Window::getClientSize(int& widthPx, int& heightPx) const {
    widthPx = heightPx = 0;
    if (!hwnd_) return;
    RECT rc;
    if (::GetClientRect((HWND)hwnd_, &rc)) {
        widthPx = rc.right - rc.left;
        heightPx = rc.bottom - rc.top;
    }
}

long long __stdcall Window::wndProcThunk(void* hwnd, unsigned int msg, unsigned long long wParam, long long lParam) {
    Window* self = nullptr;
    if (msg == WM_NCCREATE) {
        CREATESTRUCTW* cs = (CREATESTRUCTW*)lParam;
        self = (Window*)cs->lpCreateParams;
        ::SetWindowLongPtrW((HWND)hwnd, GWLP_USERDATA, (LONG_PTR)self);
        if (self) self->hwnd_ = hwnd;
    } else {
        self = (Window*)::GetWindowLongPtrW((HWND)hwnd, GWLP_USERDATA);
    }
    if (self) {
        return self->handleMessage(msg, wParam, lParam);
    }
    return ::DefWindowProcW((HWND)hwnd, msg, (WPARAM)wParam, (LPARAM)lParam);
}

long long Window::handleMessage(unsigned int msg, unsigned long long wParam, long long lParam) {
    HWND hwnd = (HWND)hwnd_;
    switch (msg) {
        case WM_CLOSE:
            shouldClose_ = true;
            return 0;
        case WM_DESTROY:
            ::PostQuitMessage(0);
            return 0;
        case WM_SIZE: {
            if (resizeCb_) {
                int w = LOWORD(lParam), h = HIWORD(lParam);
                resizeCb_(w, h);
            }
            return 0;
        }
        case WM_MOUSEMOVE: {
            if (pointerCb_) {
                PointerEvent ev{};
                ev.kind = PointerEvent::Move;
                ev.x = GET_X_LPARAM(lParam);
                ev.y = GET_Y_LPARAM(lParam);
                ev.button = 0;
                pointerCb_(ev);
            }
            return 0;
        }
        case WM_LBUTTONDOWN:
        case WM_RBUTTONDOWN:
        case WM_MBUTTONDOWN: {
            ::SetCapture(hwnd);
            if (pointerCb_) {
                PointerEvent ev{};
                ev.kind = PointerEvent::Down;
                ev.x = GET_X_LPARAM(lParam);
                ev.y = GET_Y_LPARAM(lParam);
                ev.button = (msg == WM_LBUTTONDOWN) ? 0 : (msg == WM_MBUTTONDOWN) ? 1 : 2;
                pointerCb_(ev);
            }
            return 0;
        }
        case WM_LBUTTONUP:
        case WM_RBUTTONUP:
        case WM_MBUTTONUP: {
            ::ReleaseCapture();
            if (pointerCb_) {
                PointerEvent ev{};
                ev.kind = PointerEvent::Up;
                ev.x = GET_X_LPARAM(lParam);
                ev.y = GET_Y_LPARAM(lParam);
                ev.button = (msg == WM_LBUTTONUP) ? 0 : (msg == WM_MBUTTONUP) ? 1 : 2;
                pointerCb_(ev);
            }
            return 0;
        }
        case WM_MOUSEWHEEL: {
            if (pointerCb_) {
                POINT p{ GET_X_LPARAM(lParam), GET_Y_LPARAM(lParam) };
                ::ScreenToClient(hwnd, &p);
                short delta = GET_WHEEL_DELTA_WPARAM(wParam);
                PointerEvent ev{};
                ev.kind = PointerEvent::Wheel;
                ev.x = p.x;
                ev.y = p.y;
                ev.button = 0;
                ev.deltaY = -((double)delta / (double)WHEEL_DELTA) * 100.0;
                pointerCb_(ev);
            }
            return 0;
        }
        case WM_KEYDOWN:
            if (wParam == VK_ESCAPE) {
                shouldClose_ = true;
            }
            return 0;
    }
    return ::DefWindowProcW(hwnd, msg, (WPARAM)wParam, (LPARAM)lParam);
}

} // namespace native_window
