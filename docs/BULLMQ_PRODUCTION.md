# BullMQ Production Configuration Guide

## Overview
This document outlines the production configuration for BullMQ to ensure robustness, scalability, and reliability.

## 🔧 Essential Production Settings

### 1. Redis Configuration
```env
# Primary Redis (use Redis Cluster in production)
REDIS_URL=redis://your-redis-host:6379
REDIS_PASSWORD=your-secure-password
REDIS_DB=0

# Connection settings
REDIS_CONNECT_TIMEOUT=5000
REDIS_COMMAND_TIMEOUT=5000
REDIS_MAX_RETRIES=3

# For Redis Cluster
REDIS_CLUSTER_NODES=redis-node1:6379,redis-node2:6379,redis-node3:6379
```

### 2. BullMQ Job Settings
```env
# Performance tuning
BULLMQ_MAX_CONCURRENT_JOBS=10
BULLMQ_JOB_ATTEMPTS=3
BULLMQ_JOB_BACKOFF=exponential
BULLMQ_JOB_DELAY=2000

# Memory management
BULLMQ_REMOVE_ON_COMPLETE=50
BULLMQ_REMOVE_ON_FAIL=100
```

### 3. Monitoring Configuration
```env
# Dashboard (disable in production)
BULLMQ_DASHBOARD_ENABLED=false

# Cleanup settings
BULLMQ_COMPLETED_MAX_AGE=86400000  # 24 hours
BULLMQ_FAILED_MAX_AGE=172800000    # 48 hours
BULLMQ_CLEANUP_BATCH_SIZE=100

# Alert thresholds
BULLMQ_MAX_FAILED_JOBS=10
BULLMQ_MAX_WAITING_TIME=300000     # 5 minutes
BULLMQ_MIN_SUCCESS_RATE=95
```

## 🚀 Production Deployment Checklist

### ✅ Infrastructure Requirements
- [ ] Redis Cluster (minimum 3 nodes for HA)
- [ ] Redis persistence enabled (AOF + RDB)
- [ ] Redis memory limit configured
- [ ] Load balancer for multiple app instances
- [ ] Monitoring system (Prometheus/DataDog)
- [ ] Log aggregation (ELK/Fluentd)

### ✅ Security Checklist
- [ ] Redis authentication enabled
- [ ] Network isolation (VPC/firewall rules)
- [ ] TLS encryption for Redis connections
- [ ] Monitoring endpoints protected
- [ ] API rate limiting enabled
- [ ] Security scanning completed

### ✅ Monitoring Setup
- [ ] Health check endpoints configured
- [ ] Metrics collection enabled
- [ ] Alerting rules configured
- [ ] Dashboard setup (Grafana)
- [ ] Log analysis configured
- [ ] Error tracking (Sentry)

## 📊 Performance Optimization

### Job Concurrency
```typescript
// Adjust based on your server capacity
const concurrency = process.env.NODE_ENV === 'production' ? 10 : 5;

new Worker(QUEUE_NAME, processor, {
  connection: redis,
  concurrency,
  limiter: {
    max: 100,      // Max jobs per duration
    duration: 1000, // 1 second
  }
});
```

### Memory Management
```typescript
// Automatic cleanup configuration
const queueOptions = {
  defaultJobOptions: {
    removeOnComplete: 50,  // Keep last 50 completed jobs
    removeOnFail: 100,     // Keep last 100 failed jobs
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
};
```

## 🔍 Monitoring & Alerting

### Key Metrics to Monitor
1. **Queue Metrics**
   - Queue depth (waiting jobs)
   - Processing time
   - Success/failure rates
   - Throughput (jobs/minute)

2. **Redis Metrics**
   - Memory usage
   - Connection count
   - Command latency
   - Key evictions

3. **Application Metrics**
   - CPU/Memory usage
   - Error rates
   - Response times
   - Active connections

### Alerting Rules
```yaml
# Prometheus alerting rules
groups:
  - name: bullmq
    rules:
      - alert: BullMQHighFailureRate
        expr: (bullmq_jobs_failed_total / bullmq_jobs_total) > 0.1
        for: 5m
        
      - alert: BullMQQueueBacklog
        expr: bullmq_jobs_waiting > 1000
        for: 2m
        
      - alert: RedisConnectionDown
        expr: redis_up == 0
        for: 1m
```

## 🔄 Maintenance Procedures

### Daily Tasks
- Monitor queue metrics
- Check error logs
- Verify backup status
- Review performance metrics

### Weekly Tasks
- Clean up old job data
- Review and update alerts
- Performance analysis
- Security updates

### Monthly Tasks
- Capacity planning review
- Disaster recovery testing
- Configuration optimization
- Documentation updates

## 🚨 Troubleshooting Guide

### Common Issues

1. **High Memory Usage**
   - Check job retention settings
   - Monitor Redis memory usage
   - Implement job data cleanup

2. **Jobs Getting Stuck**
   - Check worker connectivity
   - Review job timeout settings
   - Monitor Redis command latency

3. **Performance Degradation**
   - Check Redis performance
   - Review concurrency settings
   - Analyze job processing times

### Emergency Procedures

1. **Queue Backup**
   ```bash
   # Pause all queues
   curl -X POST /monitoring/bullmq/pause-all
   
   # Export critical job data
   redis-cli --scan --pattern "bull:testflow-*" > backup.txt
   ```

2. **Graceful Restart**
   ```bash
   # Signal graceful shutdown
   kill -TERM $PID
   
   # Wait for completion
   # Start new instance
   ```

## 📈 Scaling Considerations

### Horizontal Scaling
- Multiple worker instances
- Load balancing
- Shared Redis cluster
- Queue partitioning

### Vertical Scaling
- Increase worker concurrency
- Optimize job processing
- Redis memory scaling
- CPU/Memory upgrades

## 🔐 Security Best Practices

1. **Network Security**
   - VPC isolation
   - Firewall rules
   - TLS encryption
   - IP whitelisting

2. **Authentication**
   - Redis AUTH
   - API authentication
   - Role-based access
   - Token rotation

3. **Monitoring Security**
   - Secure monitoring endpoints
   - Audit logging
   - Access controls
   - Security scanning
