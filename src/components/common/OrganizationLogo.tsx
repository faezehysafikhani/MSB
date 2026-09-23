import React from 'react';

interface OrganizationLogoProps {
  className?: string;
  size?: number;
}

/** لوگوی قابل جایگزینی سازمان؛ فایل پیش‌فرض از دارایی عمومی پروژه خوانده می‌شود. */
export const OrganizationLogo: React.FC<OrganizationLogoProps> = ({ className = '', size = 40 }) => (
  <img
    src="/pars-project.png"
    alt="نشان سامانه مدیریت جلسات و مصوبات"
    width={size}
    height={size}
    className={`object-contain ${className}`}
  />
);
