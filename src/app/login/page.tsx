"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  Button,
  Input,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Link,
} from "@heroui/react";
import { Mail, Lock, User } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError("登录失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col items-center pb-0 pt-6">
          <h1 className="text-2xl font-bold">粮情管理系统</h1>
          <p className="text-gray-500">请登录您的账户</p>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="用户名"
              placeholder="请输入用户名"
              value={username}
              onValueChange={setUsername}
              startContent={<User className="w-4 h-4 text-gray-400" />}
              required
            />
            <Input
              label="密码"
              type="password"
              placeholder="请输入密码"
              value={password}
              onValueChange={setPassword}
              startContent={<Lock className="w-4 h-4 text-gray-400" />}
              required
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button
              type="submit"
              color="primary"
              className="w-full"
              isLoading={loading}
            >
              登录
            </Button>
            <Divider />
            <div className="text-center">
              <Link href="/register" size="sm">
                还没有账户？立即注册
              </Link>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
