import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '1025', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        password: process.env.SMTP_PASSWORD || '',
      },
    } as any);
  }

  private async sendMail(to: string, subject: string, html: string) {
    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || '"Digital Poverty Twin" <no-reply@example.com>',
        to,
        subject,
        html,
      });
      this.logger.log(`Email sent successfully to ${to}: ${info.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, (error as any).stack);
      return false;
    }
  }

  private getEmailTemplate(title: string, bodyContent: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            background-color: #f4f6f9;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          }
          .header {
            background-color: #1E40AF;
            padding: 30px 20px;
            text-align: center;
          }
          .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: 0.5px;
          }
          .content {
            padding: 40px 30px;
            color: #334155;
            line-height: 1.6;
          }
          .content h2 {
            color: #1E40AF;
            font-size: 20px;
            margin-top: 0;
            margin-bottom: 20px;
          }
          .content p {
            margin-top: 0;
            margin-bottom: 20px;
            font-size: 16px;
          }
          .button-container {
            text-align: center;
            margin: 30px 0;
          }
          .btn {
            background-color: #10B981;
            color: #ffffff !important;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            display: inline-block;
            box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2);
            transition: background-color 0.2s;
          }
          .footer {
            background-color: #f8fafc;
            padding: 24px;
            text-align: center;
            font-size: 12px;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
          }
          .info-box {
            background-color: #f1f5f9;
            border-left: 4px solid #1E40AF;
            padding: 15px;
            margin: 20px 0;
            border-radius: 0 8px 8px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Digital Poverty Twin</h1>
          </div>
          <div class="content">
            ${bodyContent}
          </div>
          <div class="footer">
            &copy; 2026 Digital Poverty Twin. Hak Cipta Dilindungi.<br>
            Email ini dikirim secara otomatis oleh sistem keamanan DPT. Mohon tidak membalas email ini.
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async sendWelcomeEmail(email: string, name: string) {
    const title = 'Selamat Datang di Digital Poverty Twin';
    const body = `
      <h2>Halo, ${name}!</h2>
      <p>Terima kasih telah mendaftar di platform <strong>Digital Poverty Twin (DPT)</strong>.</p>
      <p>Akun Anda telah berhasil dibuat dengan status <strong>Menunggu Persetujuan (Pending Approval)</strong>.</p>
      <div class="info-box">
        <p style="margin: 0;"><strong>Catatan Penting:</strong> Sebagai langkah keamanan, admin kami (Super Admin atau Government Admin) akan memverifikasi pendaftaran Anda sebelum Anda dapat masuk ke aplikasi DPT.</p>
      </div>
      <p>Kami akan mengirimkan email notifikasi lain segera setelah akun Anda diaktifkan.</p>
    `;
    return this.sendMail(email, title, this.getEmailTemplate(title, body));
  }

  async sendAccountApprovedEmail(email: string, name: string) {
    const title = 'Akun Digital Poverty Twin Anda Telah Aktif';
    const body = `
      <h2>Selamat, ${name}!</h2>
      <p>Akun Anda di platform <strong>Digital Poverty Twin (DPT)</strong> telah disetujui dan diaktifkan oleh Administrator.</p>
      <p>Sekarang Anda dapat masuk ke dalam aplikasi menggunakan alamat email dan kata sandi yang telah Anda daftarkan.</p>
      <div class="button-container">
        <a href="${process.env.CORS_ORIGIN || 'http://localhost:8080'}" class="btn" target="_blank">Masuk ke Aplikasi</a>
      </div>
    `;
    return this.sendMail(email, title, this.getEmailTemplate(title, body));
  }

  async sendPasswordResetEmail(email: string, name: string, token: string) {
    const title = 'Permintaan Reset Kata Sandi Digital Poverty Twin';
    const resetUrl = `${process.env.PASSWORD_RESET_URL || 'http://localhost:8080/reset-password'}?token=${token}`;
    const body = `
      <h2>Halo, ${name}!</h2>
      <p>Kami menerima permintaan untuk mereset kata sandi akun Digital Poverty Twin Anda.</p>
      <p>Silakan klik tombol di bawah ini untuk melanjutkan reset kata sandi Anda. Tautan ini akan kedaluwarsa dalam waktu <strong>1 jam</strong>.</p>
      <div class="button-container">
        <a href="${resetUrl}" class="btn" target="_blank">Reset Kata Sandi</a>
      </div>
      <div class="info-box">
        <p style="margin: 0; font-size: 14px;">Jika tombol di atas tidak berfungsi, salin dan tempel tautan berikut ke browser Anda:<br>
        <span style="word-break: break-all; color: #1E40AF;">${resetUrl}</span></p>
      </div>
      <p>Jika Anda tidak merasa mengajukan permintaan ini, Anda dapat mengabaikan email ini dengan aman. Kata sandi Anda tidak akan berubah.</p>
    `;
    return this.sendMail(email, title, this.getEmailTemplate(title, body));
  }

  async sendPasswordChangedEmail(email: string, name: string) {
    const title = 'Kata Sandi Digital Poverty Twin Berhasil Diubah';
    const body = `
      <h2>Halo, ${name}!</h2>
      <p>Kata sandi akun Digital Poverty Twin Anda telah berhasil diperbarui.</p>
      <div class="info-box" style="border-left-color: #10B981;">
        <p style="margin: 0;"><strong>Keamanan Akun:</strong> Perubahan ini dilakukan pada ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB. Seluruh sesi login di perangkat lain telah dinonaktifkan demi keamanan akun Anda.</p>
      </div>
      <p>Jika Anda merasa tidak melakukan perubahan ini, segera hubungi tim administrator sistem kami.</p>
    `;
    return this.sendMail(email, title, this.getEmailTemplate(title, body));
  }

  async sendAccountLockedEmail(email: string, name: string, durationMinutes: number) {
    const title = 'Akun Digital Poverty Twin Anda Terkunci Sementara';
    const body = `
      <h2>Pemberitahuan Keamanan Penting, ${name}!</h2>
      <p>Akun Anda telah dikunci sementara karena mendeteksi <strong>5 kali kegagalan login berturut-turut</strong>.</p>
      <div class="info-box" style="border-left-color: #EF4444; background-color: #FEF2F2;">
        <p style="margin: 0; color: #991B1B;"><strong>Status Lockout:</strong> Akun Anda akan terkunci selama <strong>${durationMinutes} menit</strong> demi melindungi keamanan data Anda dari upaya serangan brute force.</p>
      </div>
      <p>Setelah periode tersebut berlalu, akun Anda akan terbuka secara otomatis dan Anda dapat mencoba masuk kembali.</p>
    `;
    return this.sendMail(email, title, this.getEmailTemplate(title, body));
  }

  async sendNewDeviceLoginEmail(
    email: string,
    name: string,
    deviceInfo: { os: string; deviceName: string; ipAddress: string; time: string },
  ) {
    const title = 'Deteksi Sesi Login Perangkat Baru - Digital Poverty Twin';
    const body = `
      <h2>Halo, ${name}!</h2>
      <p>Kami mendeteksi aktivitas masuk (login) baru pada akun Anda dari perangkat yang belum pernah digunakan sebelumnya.</p>
      <div class="info-box">
        <p style="margin: 0 0 10px 0;"><strong>Rincian Sesi:</strong></p>
        <table style="width: 100%; font-size: 14px;">
          <tr><td style="width: 120px; font-weight: 600;">Perangkat:</td><td>${deviceInfo.deviceName} (${deviceInfo.os})</td></tr>
          <tr><td style="font-weight: 600;">Alamat IP:</td><td>${deviceInfo.ipAddress}</td></tr>
          <tr><td style="font-weight: 600;">Waktu:</td><td>${deviceInfo.time}</td></tr>
        </table>
      </div>
      <p>Jika ini adalah Anda, tidak ada tindakan lebih lanjut yang perlu diambil. Namun, jika Anda tidak mengenali aktivitas login ini, silakan masuk ke aplikasi dan cabut (revoke) sesi perangkat ini melalui menu Pengaturan Sesi.</p>
    `;
    return this.sendMail(email, title, this.getEmailTemplate(title, body));
  }
}
