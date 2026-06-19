export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      clientes: {
        Row: {
          clinica: string | null
          contacto: string | null
          creado_en: string
          ejecutivo_id: string
          estado: Database["public"]["Enums"]["estado_cliente"]
          id: string
          nombre: string
          tipo: Database["public"]["Enums"]["tipo_cliente"]
        }
        Insert: {
          clinica?: string | null
          contacto?: string | null
          creado_en?: string
          ejecutivo_id: string
          estado?: Database["public"]["Enums"]["estado_cliente"]
          id?: string
          nombre: string
          tipo?: Database["public"]["Enums"]["tipo_cliente"]
        }
        Update: {
          clinica?: string | null
          contacto?: string | null
          creado_en?: string
          ejecutivo_id?: string
          estado?: Database["public"]["Enums"]["estado_cliente"]
          id?: string
          nombre?: string
          tipo?: Database["public"]["Enums"]["tipo_cliente"]
        }
        Relationships: [
          {
            foreignKeyName: "clientes_ejecutivo_id_fkey"
            columns: ["ejecutivo_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      config_comision: {
        Row: {
          id: string
          porcentaje: number
          vigente_desde: string
        }
        Insert: {
          id?: string
          porcentaje?: number
          vigente_desde?: string
        }
        Update: {
          id?: string
          porcentaje?: number
          vigente_desde?: string
        }
        Relationships: []
      }
      interacciones: {
        Row: {
          cliente_id: string
          fecha: string
          id: string
          nota: string
          usuario_id: string
        }
        Insert: {
          cliente_id: string
          fecha?: string
          id?: string
          nota: string
          usuario_id: string
        }
        Update: {
          cliente_id?: string
          fecha?: string
          id?: string
          nota?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interacciones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interacciones_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      marcas: {
        Row: {
          activo: boolean
          creado_en: string
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          creado_en?: string
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          creado_en?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      productos: {
        Row: {
          activo: boolean
          costo_referencia: number
          creado_en: string
          id: string
          marca_id: string
          nombre: string
          precio_referencia: number
        }
        Insert: {
          activo?: boolean
          costo_referencia?: number
          creado_en?: string
          id?: string
          marca_id: string
          nombre: string
          precio_referencia?: number
        }
        Update: {
          activo?: boolean
          costo_referencia?: number
          creado_en?: string
          id?: string
          marca_id?: string
          nombre?: string
          precio_referencia?: number
        }
        Relationships: [
          {
            foreignKeyName: "productos_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "marcas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          activo: boolean
          creado_en: string
          email: string
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          creado_en?: string
          email: string
          id: string
          nombre: string
        }
        Update: {
          activo?: boolean
          creado_en?: string
          email?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      venta_items: {
        Row: {
          cantidad: number
          comision_item: number
          id: string
          precio_neto_unit: number
          producto_id: string
          subtotal_bruto: number
          subtotal_neto: number
          venta_id: string
        }
        Insert: {
          cantidad: number
          comision_item?: number
          id?: string
          precio_neto_unit: number
          producto_id: string
          subtotal_bruto?: number
          subtotal_neto?: number
          venta_id: string
        }
        Update: {
          cantidad?: number
          comision_item?: number
          id?: string
          precio_neto_unit?: number
          producto_id?: string
          subtotal_bruto?: number
          subtotal_neto?: number
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venta_items_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_items_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      ventas: {
        Row: {
          cliente_id: string
          creado_en: string
          creado_por: string | null
          ejecutivo_id: string
          fecha: string
          id: string
          porcentaje_comision: number
          total_bruto: number
          total_comision: number
          total_neto: number
        }
        Insert: {
          cliente_id: string
          creado_en?: string
          creado_por?: string | null
          ejecutivo_id: string
          fecha?: string
          id?: string
          porcentaje_comision?: number
          total_bruto?: number
          total_comision?: number
          total_neto?: number
        }
        Update: {
          cliente_id?: string
          creado_en?: string
          creado_por?: string | null
          ejecutivo_id?: string
          fecha?: string
          id?: string
          porcentaje_comision?: number
          total_bruto?: number
          total_comision?: number
          total_neto?: number
        }
        Relationships: [
          {
            foreignKeyName: "ventas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_ejecutivo_id_fkey"
            columns: ["ejecutivo_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      any_admin_exists: { Args: never; Returns: boolean }
      bootstrap_admin: {
        Args: { p_email: string; p_nombre: string }
        Returns: undefined
      }
      cambiar_rol: {
        Args: { p_rol: Database["public"]["Enums"]["app_role"]; p_user: string }
        Returns: undefined
      }
      crear_perfil_y_rol: {
        Args: {
          p_email: string
          p_nombre: string
          p_rol: Database["public"]["Enums"]["app_role"]
          p_uid: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recalcular_venta: { Args: { p_venta_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "ejecutivo"
      estado_cliente: "prospecto" | "activo" | "inactivo"
      tipo_cliente: "clinica_propia" | "recien_empieza"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "ejecutivo"],
      estado_cliente: ["prospecto", "activo", "inactivo"],
      tipo_cliente: ["clinica_propia", "recien_empieza"],
    },
  },
} as const
