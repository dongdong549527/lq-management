"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  Button,
  Input,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Link,
} from "@heroui/react";
import { Mail, Lock, User, Phone, FullName } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    email: "",
    fullName: "",
    phone: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    if (formData.password.length < 6) {
      setError("密码长度至少为6位");
      return;
    }

    setLoading(true);

    try {
      await axios.post("/api/auth/register", {
        username: formData.username,
        password: formData.password,
        email: formData.email,
        fullName: formData.fullName,
        phone: formData.phone,
      });
      router.push("/login?registered=true");
    } catch (err: any) {
      setError(err.response?.data?.error || "注册失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col items-center pb-0 pt-6">
          <h1 className="text-2xl font-bold">用户注册</h1>
          <p className="text-gray-500">请填写以下信息进行注册</p>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="用户名"
              placeholder="请输入用户名"
              value={formData.username}
              onValueChange={(v) => handleChange("username", v)}
              startContent={<User className="w-4 h-4 text-gray-400" />}
              required
            />
            <Input
              label="密码"
              type="password"
              placeholder="请输入密码（至少6位）"
              value={formData.password}
              onValueChange={(v) => handleChange("password", v)}
              startContent={<Lock className="w-4 h-4 text-gray-400" />}
              required
            />
            <Input
              label="确认密码"
              type="password"
              placeholder="请再次输入密码"
              value={formData.confirmPassword}
              onValueChange={(v) => handleChange("confirmPassword", v)}
              startContent={<Lock className="w-4 h-4 text-gray-400" />}
              required
            />
            <Input
              label="姓名"
              placeholder="请输入真实姓名"
              value={formData.fullName}
              onValueChange={(v) => handleChange("fullName", v)}
            />
            <Input
              label="邮箱"
              type="email"
              placeholder="请输入邮箱（可选）"
              value={formData.email}
              onValueChange={(v) => handleChange("email", v)}
              startContent={<Mail className="w-4 h-4 text-gray-400" />}
            />
            <Input
              label="手机号"
              placeholder="请输入手机号（可选）"
              value={formData.phone}
              onValueChange={(v) => handleChange("phone", v)}
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button
              type="submit"
              color="primary"
              className="w-full"
              isLoading={loading}
            >
              注册
            </Button>
            <Divider />
            <div className="text-center">
              <Link href="/login" size="sm">
                已有账户？立即登录
              </Link>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
