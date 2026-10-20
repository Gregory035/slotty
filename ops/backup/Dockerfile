FROM postgres:17-alpine

RUN apk add --no-cache rclone

COPY scripts/backup.sh /usr/local/bin/slotty-backup
COPY scripts/verify-backup.sh /usr/local/bin/slotty-verify-backup
RUN chmod 755 /usr/local/bin/slotty-backup /usr/local/bin/slotty-verify-backup

ENTRYPOINT ["/bin/sh", "/usr/local/bin/slotty-backup"]
