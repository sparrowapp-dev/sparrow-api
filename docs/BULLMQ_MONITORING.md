# BullMQ Monitoring & Management

This document outlines the monitoring and management features for the BullMQ-based testflow scheduling system.

## Features

### 1. Web Dashboard (Bull Board)
- **URL**: `/admin/queues` (requires super-admin authentication)
- **Features**:
  - Real-time queue statistics
  - Job status visualization (waiting, active, completed, failed)
  - Job details and logs
  - Manual job management (retry, remove)
  - Queue operations (pause, resume, clean)

### 2. REST API Monitoring Endpoints

All endpoints require super-admin authentication (`Authorization: Bearer <token>`).

#### GET `/monitoring/bullmq/metrics`
Returns comprehensive queue statistics:
```json
{
  "summary": {
    "waiting": 5,
    "active": 2,
    "completed": 150,
    "failed": 3,
    "delayed": 8,
    "repeatable": 12,
    "total": 178
  },
  "lastHour": {
    "completed": 25,
    "failed": 1,
    "successRate": 96.15
  },
  "health": {
    "isHealthy": true,
    "activeJobs": 2,
    "oldestWaitingJob": "2024-01-15T10:30:00.000Z"
  },
  "repeatableJobs": [
    {
      "name": "testflow-execution",
      "pattern": "0 * * * *",
      "next": "2024-01-15T11:00:00.000Z",
      "tz": "UTC"
    }
  ]
}
```

#### GET `/monitoring/bullmq/failed-jobs?limit=10`
Returns details of failed jobs for troubleshooting:
```json
[
  {
    "id": "123",
    "data": { "schedulerId": "abc", "testflowId": "xyz" },
    "failedReason": "Connection timeout",
    "timestamp": "2024-01-15T10:25:00.000Z",
    "attempts": 3,
    "stacktrace": ["Error details..."]
  }
]
```

#### GET `/monitoring/bullmq/health`
Simple health check endpoint:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "details": {
    "isHealthy": true,
    "activeJobs": 2,
    "oldestWaitingJob": null
  },
  "summary": {
    "waiting": 0,
    "active": 2,
    "completed": 150,
    "failed": 3,
    "total": 155
  }
}
```

#### POST `/monitoring/bullmq/cleanup`
Cleans up old completed and failed jobs:
```json
{
  "completedCleaned": 45,
  "failedCleaned": 12,
  "totalCleaned": 57
}
```

## Configuration

### Environment Variables

```env
# Enable dashboard in production (default: false in production, true in development)
BULLMQ_DASHBOARD_ENABLED=true

# Dashboard path (default: /admin/queues)
BULLMQ_DASHBOARD_PATH=/admin/queues

# Job retention settings (milliseconds)
BULLMQ_COMPLETED_MAX_AGE=86400000    # 24 hours
BULLMQ_FAILED_MAX_AGE=172800000      # 48 hours
BULLMQ_CLEANUP_BATCH_SIZE=100

# Health monitoring thresholds
BULLMQ_MAX_FAILED_JOBS=10            # Alert threshold for failed jobs
BULLMQ_MAX_WAITING_TIME=300000       # 5 minutes max waiting time
BULLMQ_MIN_SUCCESS_RATE=95           # Minimum success rate percentage
```

### Security

- All monitoring endpoints require super-admin authentication
- Dashboard access is restricted to authenticated super-admin users
- Dashboard can be disabled in production via environment variables

## Usage Examples

### 1. Monitor Queue Health
```bash
# Check overall health
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/monitoring/bullmq/health

# Get detailed metrics
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/monitoring/bullmq/metrics
```

### 2. Troubleshoot Failed Jobs
```bash
# Get last 20 failed jobs
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/monitoring/bullmq/failed-jobs?limit=20"
```

### 3. Maintenance Operations
```bash
# Clean up old jobs
curl -X POST -H "Authorization: Bearer <token>" \
  http://localhost:3000/monitoring/bullmq/cleanup
```

### 4. Access Web Dashboard
1. Login as super-admin
2. Navigate to `http://localhost:3000/admin/queues`
3. View real-time queue status and manage jobs

## Integration with Alerting

The health endpoint can be integrated with monitoring systems like:

- **Prometheus**: Scrape `/monitoring/bullmq/health` for metrics
- **DataDog**: Use API calls to collect queue statistics
- **Custom Alerts**: Monitor success rates and job failures

### Sample Prometheus Configuration
```yaml
scrape_configs:
  - job_name: 'bullmq-monitoring'
    static_configs:
      - targets: ['api:3000']
    metrics_path: '/monitoring/bullmq/health'
    headers:
      Authorization: 'Bearer <monitoring-token>'
```

## Troubleshooting

### Common Issues

1. **Dashboard not loading**:
   - Check if `BULLMQ_DASHBOARD_ENABLED=true`
   - Verify super-admin authentication
   - Ensure Redis connection is working

2. **High number of failed jobs**:
   - Check Redis connectivity
   - Review failed job details via API
   - Verify testflow execution permissions

3. **Jobs stuck in waiting**:
   - Check worker service status
   - Verify Redis memory usage
   - Review job data for corruption

### Monitoring Best Practices

1. **Regular Cleanup**: Run cleanup operations daily to prevent Redis memory issues
2. **Alert Thresholds**: Set up alerts for failed job counts and success rates
3. **Performance Monitoring**: Track job processing times and queue depths
4. **Access Control**: Restrict dashboard access to authorized personnel only

## Development vs Production

### Development
- Dashboard enabled by default
- Verbose logging enabled
- Lower cleanup thresholds for testing

### Production
- Dashboard disabled by default (enable via env var)
- Structured logging
- Conservative cleanup settings
- Monitoring integration required
