#include "bench.h"

#include <algorithm>
#include <chrono>
#include <cstdio>

#if defined(_WIN32)
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <psapi.h>
#pragma comment(lib, "psapi.lib")
#endif

namespace bench {

double monotonicMillis() {
    using namespace std::chrono;
    static const auto kEpoch = steady_clock::now();
    return duration<double, std::milli>(steady_clock::now() - kEpoch).count();
}

double processCpuMillis() {
#if defined(_WIN32)
    FILETIME creation, exit, kernel, user;
    if (!GetProcessTimes(GetCurrentProcess(), &creation, &exit, &kernel, &user)) {
        return 0.0;
    }
    auto toMs = [](const FILETIME& ft) -> double {
        ULARGE_INTEGER u;
        u.LowPart = ft.dwLowDateTime;
        u.HighPart = ft.dwHighDateTime;
        return static_cast<double>(u.QuadPart) / 10000.0; // 100ns units -> ms
    };
    return toMs(kernel) + toMs(user);
#else
    return 0.0;
#endif
}

uint64_t peakWorkingSetBytes() {
#if defined(_WIN32)
    PROCESS_MEMORY_COUNTERS pmc{};
    if (!GetProcessMemoryInfo(GetCurrentProcess(), &pmc, sizeof(pmc))) {
        return 0;
    }
    return static_cast<uint64_t>(pmc.PeakWorkingSetSize);
#else
    return 0;
#endif
}

void FrameTimer::setWarmupFrames(int n) { m_warmupFrames = n < 0 ? 0 : n; }

void FrameTimer::reserve(size_t n) { m_deltas.reserve(n); }

void FrameTimer::startFrame() {
    m_startMs = monotonicMillis();
    ++m_seenFrames;
}

void FrameTimer::endFrame() {
    if (m_seenFrames <= m_warmupFrames) {
        return; // skip warmup
    }
    m_deltas.push_back(monotonicMillis() - m_startMs);
}

FrameStats FrameTimer::finish() const {
    FrameStats s{};
    if (m_deltas.empty()) {
        return s;
    }
    std::vector<double> sorted(m_deltas);
    std::sort(sorted.begin(), sorted.end());

    double sum = 0;
    for (double d : sorted) {
        sum += d;
    }
    const size_t n = sorted.size();
    size_t pIdx = static_cast<size_t>(0.95 * n);
    if (pIdx >= n) {
        pIdx = n - 1;
    }
    s.frameCount = static_cast<int>(n);
    s.wallMs = sum;
    s.minMs = sorted.front();
    s.avgMs = sum / static_cast<double>(n);
    s.maxMs = sorted.back();
    s.p95Ms = sorted[pIdx];
    return s;
}

void FrameTimer::printBenchLine(const std::string& sceneName, const std::string& extra) const {
    const FrameStats s = finish();
    std::fprintf(stdout,
        "BENCH scene=%s frames=%d wall_ms=%.3f min_ms=%.3f avg_ms=%.3f max_ms=%.3f "
        "p95_ms=%.3f cpu_ms=%.3f mem_peak_bytes=%llu%s%s\n",
        sceneName.c_str(), s.frameCount, s.wallMs, s.minMs, s.avgMs, s.maxMs, s.p95Ms,
        processCpuMillis(), static_cast<unsigned long long>(peakWorkingSetBytes()),
        extra.empty() ? "" : " ", extra.c_str());
    std::fflush(stdout);
}

} // namespace bench
