/**
 * Performance monitoring utility for tracking slow operations
 */

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: Date;
  metadata?: any;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 1000; // Keep last 1000 metrics

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start timing an operation
   */
  startTimer(operation: string): (metadata?: any) => void {
    const startTime = Date.now();
    
    return (metadata?: any) => {
      const duration = Date.now() - startTime;
      this.recordMetric(operation, duration, metadata);
      
      // Log slow operations
      if (duration > 5000) { // 5 seconds
        console.warn(`🐌 SLOW OPERATION: ${operation} took ${duration}ms`, metadata);
      } else if (duration > 2000) { // 2 seconds
        console.log(`⚠️ Slow operation: ${operation} took ${duration}ms`);
      } else if (duration > 1000) { // 1 second
        console.log(`📊 ${operation} took ${duration}ms`);
      }
    };
  }

  /**
   * Record a performance metric
   */
  private recordMetric(operation: string, duration: number, metadata?: any): void {
    const metric: PerformanceMetric = {
      operation,
      duration,
      timestamp: new Date(),
      metadata
    };

    this.metrics.push(metric);

    // Keep only the last N metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  /**
   * Get performance statistics
   */
  getStats(operation?: string): any {
    let filteredMetrics = this.metrics;
    
    if (operation) {
      filteredMetrics = this.metrics.filter(m => m.operation === operation);
    }

    if (filteredMetrics.length === 0) {
      return { count: 0 };
    }

    const durations = filteredMetrics.map(m => m.duration);
    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = sum / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    
    // Calculate percentiles
    const sorted = durations.sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p90 = sorted[Math.floor(sorted.length * 0.9)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];

    return {
      count: filteredMetrics.length,
      avg: Math.round(avg),
      min,
      max,
      p50,
      p90,
      p95,
      recent: filteredMetrics.slice(-10).map(m => ({
        duration: m.duration,
        timestamp: m.timestamp,
        metadata: m.metadata
      }))
    };
  }

  /**
   * Get all operation types
   */
  getOperations(): string[] {
    const operations = new Set(this.metrics.map(m => m.operation));
    return Array.from(operations).sort();
  }

  /**
   * Clear metrics
   */
  clear(): void {
    this.metrics = [];
  }
}

export default PerformanceMonitor;

// Convenience function for timing operations
export const timeOperation = (operation: string) => {
  return PerformanceMonitor.getInstance().startTimer(operation);
};
